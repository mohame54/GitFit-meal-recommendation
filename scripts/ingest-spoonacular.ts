/**
 * CLI: ingest Spoonacular recipes into the local Postgres cache.
 *
 * Usage:
 *   npx tsx scripts/ingest-spoonacular.ts --random 20
 *   npx tsx scripts/ingest-spoonacular.ts --ids 716429,715538
 *   npx tsx scripts/ingest-spoonacular.ts --search "pasta" --number 10 --diet vegetarian
 */
import "dotenv/config";
import {
  ingestRandomSpoonacularRecipes,
  ingestSpoonacularByIds,
  ingestSpoonacularSearch,
} from "../src/services/ingestion.js";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(`
Ingest Spoonacular recipes into the local cache.

  --random <n>          Pull n random recipes
  --tags <csv>          Optional tags for --random (e.g. vegetarian,dinner)
  --ids <id,id,...>     Ingest specific Spoonacular recipe ids
  --search <query>      Search then cache full recipe information
  --number <n>          Result count for --search (default 10)
  --cuisine <name>      Optional cuisine filter for --search
  --diet <name>         Optional diet filter for --search
`);
    return;
  }

  if (hasFlag("--random")) {
    const n = Number(argValue("--random") ?? "10");
    const tags = argValue("--tags");
    const result = await ingestRandomSpoonacularRecipes(n, tags);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (hasFlag("--ids")) {
    const raw = argValue("--ids");
    if (!raw) throw new Error("--ids requires a comma-separated list");
    const ids = raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    const result = await ingestSpoonacularByIds(ids);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (hasFlag("--search")) {
    const query = argValue("--search");
    const number = Number(argValue("--number") ?? "10");
    const result = await ingestSpoonacularSearch({
      query,
      number,
      cuisine: argValue("--cuisine"),
      diet: argValue("--diet"),
      type: argValue("--type"),
      intolerances: argValue("--intolerances"),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error("Specify --random, --ids, or --search (see --help)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
