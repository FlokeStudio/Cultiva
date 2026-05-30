import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releasePath = resolve(root, 'cultiva.release.json');
const brandingPath = resolve(root, 'src/core/branding.js');
const packagePath = resolve(root, 'package.json');

const release = JSON.parse(readFileSync(releasePath, 'utf-8'));
const { version, codename } = release;

let branding = readFileSync(brandingPath, 'utf-8');
branding = branding.replace(/VERSION:\s*['"][^'"]+['"]/, `VERSION: '${version}'`);
branding = branding.replace(/CODENAME:\s*['"][^'"]+['"]/, `CODENAME: '${codename}'`);
writeFileSync(brandingPath, branding);

const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
if (pkg.version !== version) {
  pkg.version = version;
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
}

console.log(`[sync-version] ${release.name} ${version} · ${codename}`);
