# Orogen Manifests (The Open Data Connectors)

[![Orogen Manifests CI](https://github.com/FranekJemiolo/orogen-manifests/actions/workflows/ci.yml/badge.svg)](https://github.com/FranekJemiolo/orogen-manifests/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Registry Status](https://img.shields.io/badge/registry-18%20active%20datasets-brightgreen.svg)](https://franekjemiolo.github.io/orogen-manifests/registry.json)

> **Official open-source dataset manifest registry and modular connectors for the Orogen decentralized lakehouse.**

This repository hosts production-ready dataset manifests that execute client-side via DuckDB-Wasm and Pyodide, extracting and transforming financial data from free, publicly accessible APIs without requiring paid keys.

📖 **Looking to build or customize a connector?** See the full [Sources & Secrets Guide](docs/SOURCES_GUIDE.md).

---

## The 18 Production Connectors

| Category | ID | Engine | Source / API | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Macro** | `fred-t10y2y-spread` | `duckdb-sql` | Federal Reserve (FRED) | 10-Year Minus 2-Year Treasury yield curve spread. |
| **Macro** | `nbp-eur-pln-daily` | `duckdb-sql` | National Bank of Poland | Daily EUR/PLN midpoint foreign exchange reference rate. |
| **Macro** | `wb-global-gdp` | `duckdb-sql` | World Bank Open Data | US and EU annual GDP figures extracted via native JSON unnesting. |
| **Equities** | `yfinance-spy-daily` | `pyodide-python` | Yahoo Finance | 10 years of daily OHLCV bar data for SPY ETF. |
| **Fixed Income** | `fred-ice-bofa-hy` | `duckdb-sql` | Federal Reserve (FRED) | ICE BofA US High Yield Index Option-Adjusted Spread (credit risk premia). |
| **FX** | `ecb-eur-usd` | `duckdb-sql` | European Central Bank | Official ECB EUR/USD exchange reference rates via Data Portal REST API. |
| **Commodities** | `wb-pink-sheet` | `pyodide-python` | World Bank Commodities | Monthly benchmark prices for energy, metals, agriculture, and fertilizers. |
| **Crypto** | `binance-btc-1m` | `pyodide-python` | Binance Public API | 1-minute BTC/USDT candlestick data with timestamp pagination. |
| **Crypto** | `defillama-tvl-flows` | `duckdb-sql` | DeFi Llama REST API | Global historical Total Value Locked (TVL) across all blockchain networks. |
| **Fundamentals** | `sec-edgar-aapl` | `pyodide-python` | SEC EDGAR API | Apple Inc. 10-Q/10-K standardized balance sheet & revenue disclosures. |
| **Sentiment** | `wiki-recession-views` | `duckdb-sql` | Wikimedia REST API | Wikipedia "Recession" article daily pageviews as consumer sentiment proxy. |
| **Alternative** | `open-meteo-brazil-rain` | `duckdb-sql` | Open-Meteo Archive | 10-year daily precipitation history in Minas Gerais coffee growing basin. |
| **Alternative** | `pl-outdoor-furniture-pricing` | `pyodide-python` | Web Scraping / Retail | Outdoor furniture retail prices across Polish home improvement retailers. |
| **Satellite** | `sentinel2-l2a-earth-search` | `duckdb-sql` | AWS Element84 STAC | Sentinel-2 L2A multispectral scenes, cloud cover, and tile thumbnails. |
| **Satellite** | `nasa-earth-observatory` | `pyodide-python` | NASA Earth Observatory | Natural event satellite anomalies (wildfires, volcanic ash, severe storms). |
| **News** | `fed-press-releases` | `pyodide-python` | Federal Reserve Board | FOMC interest rate announcements, policy statements, and discount actions. |
| **News** | `sec-edgar-filings-stream` | `pyodide-python` | SEC EDGAR Atom Stream | Real-time corporate material disclosures (8-K, 10-K, 10-Q) with User-Agent. |
| **News** | `market-sentiment-news` | `duckdb-sql` | Algolia News Feed | Real-time financial headlines, sentiment discussions, and engagement scores. |

---

## Quick Reference: Adding, Configuring, and Securing Sources

### 1. Adding a New Source
1. Create a JSON manifest in `manifests/<asset_class>/<dataset_id>.json` conforming to [`schemas/dataset.schema.json`](schemas/dataset.schema.json).
2. Choose the engine:
   - `duckdb-sql`: For direct JSON/CSV endpoints and SQL transformation.
   - `pyodide-python`: For custom headers (e.g. SEC User-Agent), XML/RSS parsing, or complex loop pagination.
3. Validate and build:
   ```bash
   npm test            # Run schema checks & local DuckDB dry-runs
   npm run build       # Recompile dist/registry.json & registry.json
   ```

### 2. Configuring Existing Sources
- **Change Symbols/Parameters**: Edit the query string or URL inside `manifests/<asset_class>/<name>.json` (e.g., replace `series_id=T10Y2Y` with another FRED series).
- **Adjust Frequencies**: Update the API parameters (e.g., `interval=1h` in Binance).
- **Precision**: Update `FLOAT32` to `FLOAT64` for high-volume numerical metrics.

### 3. Managing Secrets, Tokens & API Keys
Manifests are 100% public and never contain plaintext secrets:
- **Placeholders**: Use `{{KEY_NAME}}` in scripts (e.g., `{{FRED_API_KEY}}`, `{{CORS_PROXY}}`).
- **Anticline Encrypted Vault**: In the browser, keys are encrypted at rest with **AES-GCM (256-bit)** using **PBKDF2 (100,000 rounds)** and stored in IndexedDB (`orogen_vault`). The plaintext key is only held in ephemeral memory during execution.
- **Headless Environments (CI/CLI)**: Supply keys via environment variables (e.g., `export FRED_API_KEY="your_key"`), which are automatically substituted by test runners.

---

## Architectural Mechanics

### 1. WebAssembly Linear Memory Handoff (Pyodide & DuckDB)
Pyodide and DuckDB-Wasm run in distinct WebAssembly memory spaces. Rather than incurring JSON serialization overhead:
1. Pyodide processes data into a `pandas.DataFrame` or `pyarrow.Table`.
2. Serializes the table into an Apache Arrow IPC stream using `pyarrow.ipc.new_stream()`.
3. Returns a `js.Uint8Array` memory pointer directly into DuckDB's virtual file system (`registerFileBuffer`).

### 2. Browser CORS Mitigation & User-Agent Traps
- **Direct CORS APIs:** NBP, Binance, Open-Meteo, and ECB provide permissive CORS headers natively.
- **Strict APIs:** FRED and Yahoo Finance require CORS proxy routing via `{{CORS_PROXY}}`.
- **User-Agent Enforcement:** SEC EDGAR strictly blocks browsers lacking a specific `User-Agent`. The Python connector injects the required header inside Pyodide's network context.

---

## Registry Index Compilation & Live Catalog

All manifests are validated using Ajv on every commit:

```bash
npm run build
```

The compiled registry is published directly to GitHub Pages:
**Live Catalog Endpoint:** [`https://franekjemiolo.github.io/orogen-manifests/registry.json`](https://franekjemiolo.github.io/orogen-manifests/registry.json)

The Anticline Terminal consumes this endpoint at runtime to dynamically discover new data packages.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
