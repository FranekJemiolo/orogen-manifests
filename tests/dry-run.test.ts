import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import duckdb from 'duckdb';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';

describe('Dry-Run DuckDB ETL Test Suite with Mock Payloads', () => {
  let db: duckdb.Database;
  const mockDir = resolve(__dirname, '../dist/test_mocks');

  beforeAll(async () => {
    mkdirSync(mockDir, { recursive: true });
    db = new duckdb.Database(':memory:');
    await new Promise<void>((resolvePromise, reject) => {
      db.run(
        'CREATE TYPE IF NOT EXISTS FLOAT32 AS FLOAT; CREATE TYPE IF NOT EXISTS FLOAT64 AS DOUBLE;',
        (err) => {
          if (err) reject(err);
          else resolvePromise();
        }
      );
    });
  });

  afterAll(() => {
    try {
      rmSync(mockDir, { recursive: true, force: true });
    } catch {}
  });

  function executeQuery(sql: string): Promise<any[]> {
    return new Promise((resolvePromise, reject) => {
      db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolvePromise(rows);
      });
    });
  }

  function loadManifest(relPath: string) {
    const full = resolve(__dirname, '..', relPath);
    return JSON.parse(readFileSync(full, 'utf8'));
  }

  it('executes ECB EUR/USD dry-run against mock JSON payload', async () => {
    const manifest = loadManifest('manifests/fx/ecb_eur_usd.json');
    const mockFile = join(mockDir, 'ecb_mock.json');
    const mockData = [
      { period: '2024-01-02', value: 1.0956 },
      { period: '2024-01-03', value: 1.0922 },
    ];
    writeFileSync(mockFile, JSON.stringify(mockData));

    const sql = manifest.etl.script.replace(
      manifest.etl.source_api,
      mockFile
    );
    const rows = await executeQuery(sql);

    expect(rows.length).toBe(2);
    expect(rows[0]).toHaveProperty('period');
    expect(rows[0]).toHaveProperty('value');
    expect(rows[0].period instanceof Date).toBe(true);
    expect(typeof rows[0].value).toBe('number');
  });

  it('executes FRED ICE BofA US High Yield OAS dry-run with period filtering', async () => {
    const manifest = loadManifest('manifests/fixed_income/fred_ice_bofa_hy.json');
    const mockFile = join(mockDir, 'fred_hy_mock.json');
    const mockData = {
      observations: [
        { date: '2024-01-02', value: '3.58' },
        { date: '2024-01-03', value: '.' }, // Missing holiday entry
        { date: '2024-01-04', value: '3.62' },
      ],
    };
    writeFileSync(mockFile, JSON.stringify(mockData));

    // Replace template variables with mock file path
    let sql = manifest.etl.script.replace(
      /\{\{CORS_PROXY\}\}.*?\{\{FRED_API_KEY\}\}/,
      mockFile
    );
    const rows = await executeQuery(sql);

    expect(rows.length).toBe(2); // Missing "." filtered out
    expect(rows[0].date instanceof Date).toBe(true);
    expect(typeof rows[0].spread).toBe('number');
    expect(rows[0].spread).toBeCloseTo(3.58, 2);
  });

  it('executes World Bank Global GDP dry-run and unrolls nested records', async () => {
    const manifest = loadManifest('manifests/macro/wb_global_gdp.json');
    const mockFile = join(mockDir, 'wb_gdp_mock.json');
    const mockData = [
      { page: 1, pages: 1, total: 2 },
      [
        { date: '2022', value: 25439700000000.0 },
        { date: '2023', value: 27360935000000.0 },
      ],
    ];
    writeFileSync(mockFile, JSON.stringify(mockData));

    const sql = manifest.etl.script.replace(
      manifest.etl.source_api,
      mockFile
    );
    const rows = await executeQuery(sql);

    expect(rows.length).toBe(2);
    expect(rows[0].date instanceof Date).toBe(true);
    expect(typeof rows[0].gdp_usd).toBe('number');
    expect(rows[0].gdp_usd).toBe(25439700000000.0);
  });

  it('executes Open-Meteo Brazil precipitation dry-run across parallel arrays', async () => {
    const manifest = loadManifest('manifests/alternative/open_meteo_brazil_rain.json');
    const mockFile = join(mockDir, 'meteo_mock.json');
    const mockData = {
      daily: {
        time: ['2023-01-01', '2023-01-02', '2023-01-03'],
        precipitation_sum: [14.2, 0.0, 5.8],
      },
    };
    writeFileSync(mockFile, JSON.stringify(mockData));

    const sql = manifest.etl.script.replace(
      manifest.etl.source_api,
      mockFile
    );
    const rows = await executeQuery(sql);

    expect(rows.length).toBe(3);
    expect(rows[0].time instanceof Date).toBe(true);
    expect(typeof rows[0].precipitation_sum).toBe('number');
    expect(rows[0].precipitation_sum).toBeCloseTo(14.2, 1);
  });

  it('executes Wikipedia Recession pageviews dry-run', async () => {
    const manifest = loadManifest('manifests/sentiment/wiki_recession_views.json');
    const mockFile = join(mockDir, 'wiki_mock.json');
    const mockData = {
      items: [
        { timestamp: '2022010100', views: 3412 },
        { timestamp: '2022010200', views: 4105 },
      ],
    };
    writeFileSync(mockFile, JSON.stringify(mockData));

    const sql = manifest.etl.script.replace(
      manifest.etl.source_api,
      mockFile
    );
    const rows = await executeQuery(sql);

    expect(rows.length).toBe(2);
    expect(rows[0].date instanceof Date).toBe(true);
    expect(typeof rows[0].views).toBe('number');
    expect(rows[0].views).toBe(3412);
  });

  it('executes DeFi Llama TVL dry-run with epoch timestamp conversion', async () => {
    const manifest = loadManifest('manifests/crypto/defillama_tvl.json');
    const mockFile = join(mockDir, 'defillama_mock.json');
    const mockData = [
      { date: '1672531200', totalLiquidityUSD: 45000000000.0 },
      { date: '1672617600', totalLiquidityUSD: 46200000000.0 },
    ];
    writeFileSync(mockFile, JSON.stringify(mockData));

    const sql = manifest.etl.script.replace(
      manifest.etl.source_api,
      mockFile
    );
    const rows = await executeQuery(sql);

    expect(rows.length).toBe(2);
    expect(rows[0].date instanceof Date).toBe(true);
    expect(typeof rows[0].totalLiquidityUSD).toBe('number');
    expect(rows[0].totalLiquidityUSD).toBe(45000000000.0);
  });
});
