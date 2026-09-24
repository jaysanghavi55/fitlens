// eval/capture.ts
// OPTIONAL — regenerate results/*.json by running the live pipeline over cases/*.json.
// Requires the dev server running (pnpm dev) and spends AI-gateway budget.
// Run:  node eval/capture.ts                 (all cases)
//       node eval/capture.ts case-005        (one case)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = process.env.ANALYZE_URL ?? "http://localhost:3000/api/analyze";
// RESULTS_DIR isolates a capture run into its own namespace (default "results"; current behavior
// untouched). Phase-3 captures use RESULTS_DIR=results-phase3 so the frozen results/ stay intact.
const RESULTS_DIR = process.env.RESULTS_DIR ?? "results";
const outDir = join(HERE, RESULTS_DIR);
mkdirSync(outDir, { recursive: true });
const only = process.argv[2];

const casesDir = join(HERE, "cases");
const files = readdirSync(casesDir)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !only || basename(f, ".json") === only);

if (files.length === 0) { console.error("No case files to capture."); process.exit(1); }

for (const f of files) {
  const id = basename(f, ".json");
  const c = JSON.parse(readFileSync(join(casesDir, f), "utf8")) as { jobDescription: string; resume: string };
  process.stdout.write(`Capturing ${id} … `);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobDescription: c.jobDescription, resume: c.resume }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    writeFileSync(join(outDir, `${id}.json`), JSON.stringify(data, null, 2) + "\n");
    console.log(`ok — escalated ${data?.routing?.escalated ?? "?"}/${data?.routing?.total ?? "?"}`);
  } catch (err) {
    console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
}
