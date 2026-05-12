/**
 * Copies src/images/favicon.ico → build/icon.ico (electron-builder) and electron/app-icon.ico (runtime window icon).
 * Run automatically before electron:build; safe to run anytime.
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'src', 'images', 'favicon.ico');
const buildDir = join(root, 'build');
const destBuild = join(buildDir, 'icon.ico');
const destElectron = join(root, 'electron', 'app-icon.ico');

if (!existsSync(src)) {
  console.warn('[sync-build-icon] Source missing:', src);
  process.exit(0);
}

mkdirSync(buildDir, { recursive: true });
copyFileSync(src, destBuild);
copyFileSync(src, destElectron);
console.log('[sync-build-icon] OK →', destBuild, destElectron);
