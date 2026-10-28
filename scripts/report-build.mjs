#!/usr/bin/env node
// Measure the actual uncompressed static upload, without assuming hosting limits.
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || "dist");
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile()) files.push({ path: path.relative(root, file), bytes: (await stat(file)).size });
    else throw new Error(`Unsupported build entry: ${file}`);
  }
  return files;
}
const files = await walk(root);
if (!files.length) throw new Error(`Empty build directory: ${root}`);
files.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
console.log(JSON.stringify({ directory: root, files: files.length, bytes, MiB: Number((bytes / 1024 ** 2).toFixed(3)), largest: files[0] }, null, 2));
