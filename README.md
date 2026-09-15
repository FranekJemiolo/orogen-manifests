# Orogen Manifests (The Open Data Connectors)

[![Orogen Manifests CI](https://github.com/FranekJemiolo/orogen-manifests/actions/workflows/ci.yml/badge.svg)](https://github.com/FranekJemiolo/orogen-manifests/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Registry Status](https://img.shields.io/badge/registry-active-brightgreen.svg)](https://franekjemiolo.github.io/orogen-manifests/registry.json)

> **Official open-source dataset manifest registry and modular connectors for the Orogen decentralized lakehouse.**

This repository hosts production-ready dataset manifests that execute client-side via DuckDB-Wasm and Pyodide, extracting and transforming financial data from free, publicly accessible APIs without requiring paid keys.

---

## The 4 Foundational Connectors

| Asset Class | ID | Source API | Execution Engine | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Macro** | `fred-t10y2y-spread` | Federal Reserve Economic Data (FRED) | `duckdb-sql` | 10-Year Minus 2-Year US Treasury yield curve spread. |
| **Macro / FX** | `nbp-eur-pln-daily` | National Bank of Poland (NBP) | `duckdb-sql` | 255 days of daily EUR/PLN midpoint exchange rates. |
| **Equities** | `yfinance-spy-daily` | Yahoo Finance (via Pyodide) | `pyodide-python` | 10 years of daily OHLCV bar data for SPY ETF. |
| **Crypto / HF** | `binance-btc-1m` | Binance Public API | `pyodide-python` | 1-minute BTC/USDT candlestick data with pagination. |

---

## Architectural Mechanics

### 1. WebAssembly Linear Memory Handoff (Pyodide & DuckDB)
Pyodide and DuckDB-Wasm run in distinct WebAssembly linear memory spaces. Rather than incurring JSON serialization overhead:
1. Pyodide cleans and structures the data as a `pandas.DataFrame`.
2. Converts the DataFrame into a `pyarrow.Table`.
3. Serializes the table into an Apache Arrow IPC stream using `pyarrow.ipc.RecordBatchStreamWriter`.
4. Returns a `js.Uint8Array` memory pointer directly into DuckDB's virtual file system (`registerFileBuffer`).

### 2. Browser CORS Mitigation & User-Agent Traps
- **Direct CORS APIs:** NBP and Binance provide permissive CORS headers natively.
- **Strict APIs:** FRED and Yahoo Finance require CORS proxy routing.
- The Yahoo Finance connector subclasses `requests.Session` (`CorsProxySession`), encodes the URL with `urllib.parse.quote()`, and strips custom `User-Agent` headers to prevent browser preflight (OPTIONS) rejection.

### 3. Rate-Limiting & Timestamp Pagination
The Binance connector queries the `/api/v3/klines` endpoint in 1000-candle batches inside a timestamp-shifting `while` loop, with `time.sleep(0.5)` backoffs between iterations to prevent HTTP 429 rate-limiting.

---

## Registry Index Compilation & Live Catalog

All manifests are strictly validated against [`schemas/dataset.schema.json`](schemas/dataset.schema.json) using Ajv on every commit:

```bash
# Validate and build registry index
npm run build
```

The compiled registry is published directly to GitHub Pages:
**Live Catalog Endpoint:** [`https://franekjemiolo.github.io/orogen-manifests/registry.json`](https://franekjemiolo.github.io/orogen-manifests/registry.json)

The Anticline Terminal consumes this endpoint at runtime to discover new data packages.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
