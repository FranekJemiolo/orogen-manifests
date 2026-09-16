import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('Orogen Data Connectors Manifest Test Suite', () => {
  const schemaPath = resolve(__dirname, '../schemas/dataset.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  function loadManifest(relPath: string) {
    const full = resolve(__dirname, '..', relPath);
    return JSON.parse(readFileSync(full, 'utf8'));
  }

  it('validates FRED Yield Curve manifest (fred_yield_curve.json)', () => {
    const manifest = loadManifest('manifests/macro/fred_yield_curve.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('UNNEST(observations)');
    expect(manifest.etl.script).toContain("NULLIF(obs.value, '.')");
  });

  it('validates NBP EUR/PLN exchange rate manifest (nbp_eur_pln.json)', () => {
    const manifest = loadManifest('manifests/macro/nbp_eur_pln.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('UNNEST(rates)');
    expect(manifest.etl.script).toContain('FLOAT32');
  });

  it('validates Yahoo Finance SPY daily manifest (yfinance_spy_daily.json)', () => {
    const manifest = loadManifest('manifests/equities/yfinance_spy_daily.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.etl.engine).toBe('pyodide-python');
    expect(manifest.etl.requirements).toContain('yfinance');
    expect(manifest.etl.requirements).toContain('pyarrow');
    expect(manifest.etl.script).toContain('CorsProxySession');
    expect(manifest.etl.script).toContain('Uint8Array.new');
  });

  it('validates Binance BTC 1-minute paginated manifest (binance_btc_1m.json)', () => {
    const manifest = loadManifest('manifests/crypto/binance_btc_1m.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.etl.engine).toBe('pyodide-python');
    expect(manifest.etl.requirements).toContain('pyarrow');
    expect(manifest.etl.script).toContain('while current_start < end_time');
    expect(manifest.etl.script).toContain('time.sleep(0.5)'); // Rate limit defense
    expect(manifest.etl.script).toContain('Uint8Array.new');
  });

  it('validates SEC EDGAR AAPL Fundamentals manifest (sec_edgar_aapl.json)', () => {
    const manifest = loadManifest('manifests/fundamentals/sec_edgar_aapl.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('fundamentals');
    expect(manifest.etl.engine).toBe('pyodide-python');
    expect(manifest.etl.requirements).toContain('requests');
    expect(manifest.etl.requirements).toContain('pandas');
    expect(manifest.etl.requirements).toContain('pyarrow');
    expect(manifest.etl.script).toContain('User-Agent');
    expect(manifest.etl.script).toContain('NetIncomeLoss');
    expect(manifest.etl.script).toContain('Revenues');
    expect(manifest.etl.script).toContain('Uint8Array.new');
  });

  it('validates Polish outdoor furniture retail pricing manifest (pl_outdoor_furniture_pricing.json)', () => {
    const manifest = loadManifest('manifests/alternative/pl_outdoor_furniture_pricing.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('alternative');
    expect(manifest.etl.engine).toBe('pyodide-python');
    expect(manifest.etl.requirements).toContain('beautifulsoup4');
    expect(manifest.etl.requirements).toContain('requests');
    expect(manifest.etl.script).toContain('CorsProxySession');
    expect(manifest.etl.script).toContain('\\xa0');
    expect(manifest.etl.script).toContain('replace(\',\', \'.\')');
    expect(manifest.etl.script).toContain('Uint8Array.new');
  });

  it('validates Wikipedia Recession pageviews manifest (wiki_recession_views.json)', () => {
    const manifest = loadManifest('manifests/sentiment/wiki_recession_views.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('sentiment');
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('UNNEST(items)');
    expect(manifest.etl.script).toContain('strptime(item.timestamp, \'%Y%m%d%H\')');
    expect(manifest.etl.script).toContain('FLOAT32');
  });

  it('validates DeFi Llama TVL flows manifest (defillama_tvl.json)', () => {
    const manifest = loadManifest('manifests/crypto/defillama_tvl.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('crypto');
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('to_timestamp(CAST(date AS BIGINT))');
    expect(manifest.etl.script).toContain('FLOAT64');
  });

  it('validates ECB EUR/USD reference rate manifest (ecb_eur_usd.json)', () => {
    const manifest = loadManifest('manifests/fx/ecb_eur_usd.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('fx');
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('CAST(period AS TIMESTAMP)');
    expect(manifest.etl.script).toContain('FLOAT32');
  });

  it('validates FRED ICE BofA US High Yield Index OAS manifest (fred_ice_bofa_hy.json)', () => {
    const manifest = loadManifest('manifests/fixed_income/fred_ice_bofa_hy.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('fixed_income');
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('BAMLH0A0HYM2');
    expect(manifest.etl.script).toContain('{{FRED_API_KEY}}');
    expect(manifest.etl.script).toContain('{{CORS_PROXY}}');
    expect(manifest.etl.script).toContain("NULLIF(obs.value, '.')");
  });

  it('validates World Bank Global GDP manifest (wb_global_gdp.json)', () => {
    const manifest = loadManifest('manifests/macro/wb_global_gdp.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('macro');
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('UNNEST');
    expect(manifest.etl.script).toContain('NY.GDP.MKTP.CD');
    expect(manifest.etl.script).toContain('FLOAT64');
  });

  it('validates World Bank Pink Sheet commodities manifest (wb_pink_sheet.json)', () => {
    const manifest = loadManifest('manifests/commodities/wb_pink_sheet.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('commodities');
    expect(manifest.etl.engine).toBe('pyodide-python');
    expect(manifest.etl.requirements).toContain('requests');
    expect(manifest.etl.requirements).toContain('pandas');
    expect(manifest.etl.requirements).toContain('pyarrow');
    expect(manifest.etl.script).toContain('commodity_index');
    expect(manifest.etl.script).toContain('energy_index');
    expect(manifest.etl.script).toContain('Uint8Array.new');
  });

  it('validates Open-Meteo Brazil precipitation manifest (open_meteo_brazil_rain.json)', () => {
    const manifest = loadManifest('manifests/alternative/open_meteo_brazil_rain.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('alternative');
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('UNNEST(daily.time)');
    expect(manifest.etl.script).toContain('UNNEST(daily.precipitation_sum)');
    expect(manifest.etl.script).toContain('FLOAT');
  });

  it('validates Sentinel-2 satellite observation manifest (sentinel2_l2a_earth_search.json)', () => {
    const manifest = loadManifest('manifests/satellite/sentinel2_l2a_earth_search.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('satellite');
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('UNNEST(features)');
    expect(manifest.etl.script).toContain('eo:cloud_cover');
    expect(manifest.etl.script).toContain('thumbnail_url');
  });

  it('validates NASA Earth Observatory satellite events manifest (nasa_earth_observatory.json)', () => {
    const manifest = loadManifest('manifests/satellite/nasa_earth_observatory.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('satellite');
    expect(manifest.etl.engine).toBe('pyodide-python');
    expect(manifest.etl.requirements).toContain('requests');
    expect(manifest.etl.requirements).toContain('pandas');
    expect(manifest.etl.requirements).toContain('pyarrow');
    expect(manifest.etl.script).toContain('ET.fromstring');
    expect(manifest.etl.script).toContain('Uint8Array.new');
  });

  it('validates Federal Reserve press releases news manifest (fed_press_releases.json)', () => {
    const manifest = loadManifest('manifests/news/fed_press_releases.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('news');
    expect(manifest.etl.engine).toBe('pyodide-python');
    expect(manifest.etl.requirements).toContain('requests');
    expect(manifest.etl.requirements).toContain('pandas');
    expect(manifest.etl.requirements).toContain('pyarrow');
    expect(manifest.etl.script).toContain('ET.fromstring');
    expect(manifest.etl.script).toContain('Uint8Array.new');
  });

  it('validates SEC EDGAR filings stream news manifest (sec_edgar_filings_stream.json)', () => {
    const manifest = loadManifest('manifests/news/sec_edgar_filings_stream.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('news');
    expect(manifest.etl.engine).toBe('pyodide-python');
    expect(manifest.etl.requirements).toContain('requests');
    expect(manifest.etl.requirements).toContain('pandas');
    expect(manifest.etl.requirements).toContain('pyarrow');
    expect(manifest.etl.script).toContain('User-Agent');
    expect(manifest.etl.script).toContain('atom:entry');
    expect(manifest.etl.script).toContain('Uint8Array.new');
  });

  it('validates Real-Time Market Sentiment News manifest (market_sentiment_news.json)', () => {
    const manifest = loadManifest('manifests/news/market_sentiment_news.json');
    const valid = validate(manifest);
    expect(validate.errors).toBeNull();
    expect(valid).toBe(true);
    expect(manifest.asset_class).toBe('news');
    expect(manifest.etl.engine).toBe('duckdb-sql');
    expect(manifest.etl.script).toContain('UNNEST(hits)');
    expect(manifest.etl.script).toContain('score');
    expect(manifest.etl.script).toContain('comment_count');
  });
});



