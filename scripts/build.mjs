import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, '..');

const srcFile = path.join(rootDir, 'src', 'cli.mjs');
const distDir = path.join(rootDir, 'dist');
const distFile = path.join(distDir, 'cli.mjs');

await fs.mkdir(distDir, { recursive: true });
await fs.copyFile(srcFile, distFile);

try {
  await fs.chmod(distFile, 0o755);
} catch {
  // ignore (e.g. Windows)
}

