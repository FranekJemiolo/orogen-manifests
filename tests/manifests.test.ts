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
});

