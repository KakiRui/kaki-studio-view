import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";

const snapshotDir = path.resolve("snapshots");
const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
let removed = 0;

let entries = [];
try {
  entries = await readdir(snapshotDir, { withFileTypes: true });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const filePath = path.join(snapshotDir, entry.name);
  try {
    const snapshot = JSON.parse(await readFile(filePath, "utf8"));
    const createdAt = Date.parse(snapshot.createdAt);
    if (Number.isFinite(createdAt) && createdAt <= cutoff) {
      await unlink(filePath);
      removed += 1;
    }
  } catch (error) {
    console.warn(`Skipping unreadable snapshot ${entry.name}: ${error.message}`);
  }
}

console.log(`Removed ${removed} expired snapshot(s).`);
