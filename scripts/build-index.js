import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const rootDir = process.cwd();
const schemaPath = resolve(rootDir, 'schemas/dataset.schema.json');
const manifestsDir = resolve(rootDir, 'manifests');
const distDir = resolve(rootDir, 'dist');

// 1. Initialize Ajv schema validator
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

// 2. Recursively find all JSON manifest files
function findManifestFiles(dir) {
  const files = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...findManifestFiles(fullPath));
    } else if (extname(entry) === '.json') {
      files.push(fullPath);
    }
  }
  return files;
}

const manifestFiles = findManifestFiles(manifestsDir);
console.log(`Found ${manifestFiles.length} dataset manifests in ${manifestsDir}`);

const registryItems = [];
let hasErrors = false;

for (const filePath of manifestFiles) {
  try {
    const content = JSON.parse(readFileSync(filePath, 'utf8'));
    const isValid = validate(content);

    if (!isValid) {
      console.error(`Validation failed for ${filePath}:`);
      console.error(validate.errors);
      hasErrors = true;
      continue;
    }

    registryItems.push({
      id: content.id,
      name: content.name,
      description: content.description || '',
      asset_class: content.asset_class,
      columns: content.schema.map((c) => ({ name: c.column, type: c.type })),
      etl: {
        engine: content.etl.engine,
        source_api: content.etl.source_api,
        requirements: content.etl.requirements || [],
      },
      manifest_url: `https://raw.githubusercontent.com/FranekJemiolo/orogen-manifests/main/${filePath.replace(rootDir + '/', '')}`,
    });

    console.log(`✓ Validated: [${content.asset_class.toUpperCase()}] ${content.id} - "${content.name}"`);
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('Fatal: Manifest schema validation errors encountered.');
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });

const registryPayload = {
  version: '1.0.0',
  generated_at: new Date().toISOString(),
  total_datasets: registryItems.length,
  datasets: registryItems,
};

const outputPath = join(distDir, 'registry.json');
writeFileSync(outputPath, JSON.stringify(registryPayload, null, 2));

console.log(`\nSuccessfully compiled registry index with ${registryItems.length} datasets.`);
console.log(`Output: ${outputPath}`);
