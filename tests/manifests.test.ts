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
});
