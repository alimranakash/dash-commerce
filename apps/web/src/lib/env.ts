import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const libDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(libDir, "../../../..");

config({ path: resolve(repoRoot, ".env"), quiet: true });
config({ path: resolve(repoRoot, ".env.local"), override: true, quiet: true });
