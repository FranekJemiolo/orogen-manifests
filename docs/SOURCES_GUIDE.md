# Comprehensive Guide: Adding, Configuring, and Securing Orogen Data Sources

This document is the authoritative technical reference for creating new data connectors, configuring existing pipelines, and managing API keys/secrets for the **Orogen Decentralized Quant Lakehouse**.

---

## Table of Contents

1. [Architectural Overview](#1-architectural-overview)
2. [Anatomy of a Dataset Manifest](#2-anatomy-of-a-dataset-manifest)
3. [Engine 1: Authoring DuckDB-SQL Pipelines](#3-engine-1-authoring-duckdb-sql-pipelines)
4. [Engine 2: Authoring Pyodide-Python Pipelines](#4-engine-2-authoring-pyodide-python-pipelines)
5. [Managing Secrets, Tokens, and API Keys](#5-managing-secrets-tokens-and-api-keys)
6. [CORS Proxies, Headers, and Network Restrictions](#6-cors-proxies-headers-and-network-restrictions)
7. [Configuring Existing Sources](#7-configuring-existing-sources)
8. [Testing, Validation, and Index Compilation](#8-testing-validation-and-index-compilation)
9. [Step-by-Step Tutorial: Adding a New Source](#9-step-by-step-tutorial-adding-a-new-source)

---

## 1. Architectural Overview

Orogen operates on a **zero-backend, client-side execution model**. Rather than utilizing central ETL servers (like Airflow or Kafka), data extraction and transformation occur directly within the analyst's browser using WebAssembly:

```
[ Public Web API / REST / STAC / RSS ]
                   │
                   ▼ (HTTP GET / CORS Proxy)
┌────────────────────────────────────────────────────────┐
│           Browser WebAssembly Execution Sandbox        │
│                                                        │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │   DuckDB-Wasm Engine  │   │  Pyodide WASM Engine │  │
│  │    (duckdb-sql)       │   │   (pyodide-python)   │  │
│  └───────────┬───────────┘   └──────────┬───────────┘  │
│              │                          │              │
│              ▼                          ▼              │
│     Native Arrow Tables        pyarrow.ipc Stream      │
│              │                          │              │
│              └───────────┬──────────────┘              │
│                          ▼                             │
│               Apache Arrow IPC Buffer                  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
          [ OPFS (Origin Private File System) ]
```

Each data source is represented by a declarative JSON file called a **Dataset Manifest**.

---

## 2. Anatomy of a Dataset Manifest

All manifests reside in the `manifests/<asset_class>/` directory and are validated against [`schemas/dataset.schema.json`](../schemas/dataset.schema.json).

### Schema Specification

```json
{
  "$schema": "../../schemas/dataset.schema.json",
  "id": "unique-dataset-kebab-id",
  "name": "Human Readable Dataset Title",
  "description": "Comprehensive explanation of what data is collected, economic significance, and update frequency.",
  "asset_class": "macro",
  "schema": [
    { "column": "timestamp", "type": "TIMESTAMP" },
    { "column": "metric_name", "type": "FLOAT32" },
    { "column": "category", "type": "UTF8" }
  ],
  "etl": {
    "engine": "duckdb-sql",
    "source_api": "https://api.example.com/v1/data",
    "script": "SELECT ...",
    "requirements": ["pandas", "pyarrow"]
  }
}
```

### Supported Asset Classes
The `asset_class` property must be one of:
- `macro` (GDP, CPI, interest rates, money supply)
- `equities` (Stock prices, ETF bars, dividend streams)
- `fixed_income` (Yield curves, credit spreads, OAS metrics)
- `fx` (Central bank exchange rates, currency pairs)
- `commodities` (Metals, energy benchmarks, agricultural spot prices)
- `crypto` (On-chain TVL, exchange order books, klines)
- `fundamentals` (SEC EDGAR balance sheets, cash flow statements)
- `sentiment` (Search interest, social metrics, Wikipedia view counts)
- `alternative` (Foot traffic, shipping AIS, weather archives)
- `satellite` (Sentinel-2 STAC catalogs, NASA Earth Observation feeds)
- `news` (FOMC press releases, SEC corporate 8-K feeds, breaking market headlines)

### Supported Column Types
Orogen Arrow schemas support:
- `TIMESTAMP`: Microsecond or millisecond temporal timestamps (parsed to UTC).
- `FLOAT32`: 32-bit single-precision float (ideal for rates, percentages, indices).
- `FLOAT64`: 64-bit double-precision float (ideal for high-value totals, market caps, currency volumes).
- `UTF8`: String/text fields (identifiers, titles, URLs, descriptions).

---

## 3. Engine 1: Authoring DuckDB-SQL Pipelines

`duckdb-sql` is the preferred engine when the target API serves JSON or CSV data that can be ingested directly via DuckDB's native functions (`read_json_auto`, `read_csv_auto`).

### Advantages
- Extremely fast native C++ execution compiled to WebAssembly.
- Direct query generation of Arrow tables with zero conversion overhead.
- Advanced SQL window functions, date parsing, and array unnesting.

### Pattern: Ingesting Nested JSON Arrays
Most REST APIs return nested JSON payloads (`{ "observations": [ { "date": "...", "val": 1.2 } ] }`). Use `UNNEST`:

```sql
WITH raw AS (
  SELECT UNNEST(observations) AS obs 
  FROM read_json_auto('{{CORS_PROXY}}https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&file_type=json&api_key={{FRED_API_KEY}}')
)
SELECT 
  CAST(obs.date AS TIMESTAMP) AS date,
  CAST(NULLIF(obs.value, '.') AS FLOAT32) AS spread
FROM raw
WHERE obs.value != '.';
```

### Pattern: Unnesting Parallel Arrays
APIs like Open-Meteo return synchronized parallel arrays (`time: [...]`, `precipitation_sum: [...]`). Use `generate_subscripts`:

```sql
WITH raw AS (
  SELECT daily FROM read_json_auto('https://archive-api.open-meteo.com/v1/archive?latitude=-19.92&longitude=-43.94&start_date=2014-01-01&end_date=2024-01-01&daily=precipitation_sum&timezone=UTC')
),
indices AS (
  SELECT unnest(generate_subscripts(raw.daily.time, 1)) AS idx, daily FROM raw
)
SELECT
  CAST(daily.time[idx] AS TIMESTAMP) AS timestamp,
  CAST(daily.precipitation_sum[idx] AS FLOAT32) AS precipitation_mm
FROM indices;
```

### Pattern: STAC (Spatio-Temporal Asset Catalog) Satellite Metadata
Extracting satellite scenes with nested properties:

```sql
WITH raw AS (
  SELECT unnest(features) AS feat 
  FROM read_json_auto('https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items?limit=100')
)
SELECT
  CAST(feat.id AS VARCHAR) AS scene_id,
  CAST(feat.properties.datetime AS TIMESTAMP) AS timestamp,
  CAST(feat.properties."eo:cloud_cover" AS FLOAT32) AS cloud_cover_pct,
  CAST(feat.properties."grid:code" AS VARCHAR) AS grid_square,
  CAST(feat.assets.thumbnail.href AS VARCHAR) AS thumbnail_url
FROM raw;
```

---

## 4. Engine 2: Authoring Pyodide-Python Pipelines

Use `pyodide-python` when:
1. The source API requires custom HTTP headers (e.g. SEC EDGAR `User-Agent: CompanyName email@domain.com`).
2. The endpoint returns XML or RSS/Atom feeds requiring DOM/ElementTree parsing.
3. Complex multi-page pagination or rate-limiting backoffs are required (e.g. Binance 1000-candle loop).
4. Raw CSVs require dynamic header detection or multi-index transformation.

### Execution Contract
The Python script MUST:
1. Fetch and process the data.
2. Construct a `pyarrow.Table` conforming to the manifest schema.
3. Serialize the table to an Apache Arrow IPC stream using `pyarrow.ipc.new_stream()`.
4. Return a `js.Uint8Array` of the resulting buffer.
5. Provide a fallback dataset for offline/headless CI runs.

### Standard Template:

```python
import io
import urllib.request
import pyarrow as pa
import pyarrow.ipc as ipc

# 1. Fetch remote data with custom headers
url = "https://example.com/api/feed"
req = urllib.request.Request(
    url,
    headers={"User-Agent": "OrogenLakehouse research@orogen.local"}
)

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        content = response.read()
    # Process content...
    data = {"date": ["2026-01-01 00:00:00"], "value": [100.5]}
except Exception as e:
    # 2. Offline / CI fallback
    data = {"date": ["2026-01-01 00:00:00"], "value": [0.0]}

# 3. Create PyArrow Table
arrow_schema = pa.schema([
    ('date', pa.timestamp('us')),
    ('value', pa.float32())
])
table = pa.Table.from_pydict(data, schema=arrow_schema)

# 4. Serialize to Arrow IPC Stream
sink = io.BytesIO()
with ipc.new_stream(sink, arrow_schema) as writer:
    writer.write_table(table)

# 5. Export to JavaScript Uint8Array for zero-copy DuckDB handoff
import js
js.Uint8Array.new(sink.getvalue())
```

### Parsing XML and RSS Feeds
For RSS or Atom feeds (e.g. Federal Reserve Press Releases, NASA Earth Observatory), use Python's standard `xml.etree.ElementTree`—it requires no extra pip packages:

```python
import xml.etree.ElementTree as ET
root = ET.fromstring(xml_content)
items = root.findall('./channel/item')
for item in items:
    title = item.find('title').text
    pub_date = item.find('pubDate').text
    link = item.find('link').text
```

---

## 5. Managing Secrets, Tokens, and API Keys

Orogen is designed so that manifests remain **100% public, git-tracked, and stateless**. Sensitive credentials must NEVER be committed to a manifest.

### 1. Template Interpolation Syntax
Include placeholder variables inside the manifest SQL or Python script:
- `{{FRED_API_KEY}}`
- `{{POLYGON_API_KEY}}`
- `{{ALPHA_VANTAGE_KEY}}`

Example:
```json
"script": "SELECT * FROM read_json_auto('https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key={{FRED_API_KEY}}')"
```

### 2. Client-Side Vault (Web Crypto AES-GCM)
When Anticline detects `{{KEY_NAME}}` in an active pipeline:
1. It checks whether the key exists in the browser's local encrypted vault.
2. If absent, Anticline presents a secure modal prompt.
3. The key is encrypted using **AES-GCM 256-bit encryption** derived via **PBKDF2 (100,000 iterations)** from the user's session master key.
4. The encrypted ciphertext is stored in the browser's IndexedDB (`orogen_vault/api_keys`).
5. The plaintext key exists strictly in ephemeral memory during execution and is injected into the query template at runtime.

### 3. Headless Environment Variables (CI / CLI)
For automated runners, tests, or scripts:
- Export the environment variable in your shell:
  ```bash
  export FRED_API_KEY="your_secret_key_here"
  ```
- Orogen's CLI and test harness automatically substitute process environment variables into matching `{{KEY_NAME}}` placeholders.

---

## 6. CORS Proxies, Headers, and Network Restrictions

Because Orogen runs in the browser, HTTP requests are subject to browser Cross-Origin Resource Sharing (CORS) rules.

### Understanding the 3 Types of APIs:
1. **Open CORS APIs (Direct Access)**:
   - Examples: ECB Data Portal, Binance, Open-Meteo, World Bank Open Data.
   - These servers return `Access-Control-Allow-Origin: *`. No proxy required.
2. **Restricted CORS APIs (Proxy Required)**:
   - Examples: FRED API, Yahoo Finance.
   - Use the template placeholder `{{CORS_PROXY}}` in the manifest URL:
     ```json
     "script": "SELECT * FROM read_json_auto('{{CORS_PROXY}}https://api.stlouisfed.org/...')"
     ```
   - In Anticline, the default proxy is configurable in Settings (`https://corsproxy.io/?url=` or a custom self-hosted proxy).
3. **Restricted Header APIs (User-Agent Enforcement)**:
   - Examples: SEC EDGAR requires `User-Agent: Sample Company Name AdminContact@domain.com`.
   - Standard browser `fetch()` blocks setting the forbidden `User-Agent` header.
   - **Solution**: Use `pyodide-python` with `urllib.request` or route through a proxy endpoint that forwards the required identity headers.

---

## 7. Configuring Existing Sources

To customize or tune an existing dataset manifest:

### 1. Changing Series or Tickers
Locate the manifest in `manifests/<asset_class>/<dataset_name>.json`.
- **FRED Series**: Modify the `series_id` query parameter (e.g. change `T10Y2Y` to `DFII10` for 10-Year TIPS).
- **Yahoo Finance**: Modify the ticker symbol inside the Pyodide script (e.g. change `'SPY'` to `'QQQ'`).
- **ECB Rates**: Change the currency pair key (e.g. change `EXR.D.USD.EUR.SP00.A` to `EXR.D.JPY.EUR.SP00.A`).

### 2. Adjusting Historical Windows and Frequencies
- Adjust `start_date` and `end_date` parameters in the API URL.
- For high-frequency feeds (e.g. Binance), change the interval parameter (`1m`, `5m`, `1h`, `1d`).

### 3. Schema Type Precision
- If a metric requires high precision (e.g. currency fractions or massive market caps), adjust the schema type from `FLOAT32` to `FLOAT64` in both the `schema` array and the SQL `CAST(...)` statement.

---

## 8. Testing, Validation, and Index Compilation

Before submitting a new or modified connector, run the local validation pipeline:

### 1. Schema Conformance
Validate all manifests against `dataset.schema.json`:
```bash
npm run validate
```

### 2. Vitest Test Suite
Run schema and unit tests:
```bash
npm test
```

### 3. Dry-Run In-Memory ETL Tests
The test suite in [`tests/dry-run.test.ts`](../tests/dry-run.test.ts) uses local mock fixtures to verify that SQL queries parse and cast data correctly without triggering live external network requests. When adding a new DuckDB query, add a test case to verify column extraction:

```typescript
it('dry-runs my-new-dataset query', async () => {
  const manifest = JSON.parse(fs.readFileSync('manifests/macro/my_new_dataset.json', 'utf8'));
  const sql = manifest.etl.script.replace(/read_json_auto\('[^']+'\)/, "read_json_auto('tests/fixtures/mock_data.json')");
  const res = await db.all(sql);
  expect(res.length).toBeGreaterThan(0);
});
```

### 4. Build the Production Index
Recompile the registry catalog:
```bash
npm run build
```
This updates both `dist/registry.json` and the root `registry.json` which is automatically deployed to GitHub Pages via CI.

---

## 9. Step-by-Step Tutorial: Adding a New Source

Let's walk through adding the **US Consumer Price Index (CPI)** from FRED.

### Step 1: Create the Manifest File
Create `manifests/macro/fred_cpi.json`:

```json
{
  "$schema": "../../schemas/dataset.schema.json",
  "id": "fred-cpi-monthly",
  "name": "FRED US Consumer Price Index (CPI)",
  "description": "Monthly Consumer Price Index for All Urban Consumers: All Items in U.S. City Average. Primary gauge for inflation research.",
  "asset_class": "macro",
  "schema": [
    { "column": "date", "type": "TIMESTAMP" },
    { "column": "cpi", "type": "FLOAT32" }
  ],
  "etl": {
    "engine": "duckdb-sql",
    "source_api": "https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&file_type=json",
    "script": "WITH raw_data AS (SELECT UNNEST(observations) AS obs FROM read_json_auto('{{CORS_PROXY}}https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&file_type=json&api_key={{FRED_API_KEY}}')) SELECT CAST(obs.date AS TIMESTAMP) AS date, CAST(NULLIF(obs.value, '.') AS FLOAT32) AS cpi FROM raw_data WHERE obs.value != '.';"
  }
}
```

### Step 2: Register in Anticline
Add the connector entry to `anticline/src/components/terminal/DatasetRegistry.ts`:

```typescript
{
  id: 'fred-cpi-monthly',
  name: 'FRED US Consumer Price Index (CPI)',
  description: 'Monthly Consumer Price Index for All Urban Consumers.',
  asset_class: 'macro',
  schema: [
    { column: 'date', type: 'TIMESTAMP' },
    { column: 'cpi', type: 'FLOAT32' }
  ],
  etl: {
    engine: 'duckdb-sql',
    source_api: 'https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&file_type=json',
    script: "WITH raw_data AS (SELECT UNNEST(observations) AS obs FROM read_json_auto('{{CORS_PROXY}}https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&file_type=json&api_key={{FRED_API_KEY}}')) SELECT CAST(obs.date AS TIMESTAMP) AS date, CAST(NULLIF(obs.value, '.') AS FLOAT32) AS cpi FROM raw_data WHERE obs.value != '.';"
  }
}
```

### Step 3: Run Tests & Build Index
```bash
cd orogen-manifests
npm test
npm run build
```

### Step 4: Commit and Push
```bash
git add manifests/macro/fred_cpi.json dist/registry.json registry.json
git commit -m "feat(manifests): add FRED US Consumer Price Index (CPI)"
git push origin main
```
CI will run schema validation, deploy the updated registry index to GitHub Pages, and Anticline terminals will automatically discover the new connector on their next catalog sync!
