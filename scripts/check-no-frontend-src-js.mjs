import { readdir } from 'node:fs/promises';
import path from 'node:path';

const srcDir = path.resolve('apps/frontend/src');
const forbiddenExtensions = new Set(['.js', '.jsx']);
const matches = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(fullPath);
      return;
    }

    if (entry.isFile() && forbiddenExtensions.has(path.extname(entry.name))) {
      matches.push(path.relative(process.cwd(), fullPath).replaceAll(path.sep, '/'));
    }
  }));
}

await walk(srcDir);

if (matches.length > 0) {
  console.error('Compiled JavaScript is not allowed in apps/frontend/src:');
  for (const match of matches.sort()) {
    console.error(`- ${match}`);
  }
  console.error('Move build output to apps/frontend/dist or convert the source to TypeScript.');
  process.exit(1);
}
