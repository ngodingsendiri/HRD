/**
 * Move api/_handlers → src/server/handlers and fix relative imports.
 * Why: Vercel ignores api/_* paths; dynamic imports to _handlers can 500 in production.
 */
import fs from "fs";
import path from "path";

const srcRoot = "api/_handlers";
const destRoot = "src/server/handlers";

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function rewrite(code, rel) {
  // From api/_handlers/<rel> to src/server/handlers/<rel>
  // api/_handlers/employees.ts:
  //   ../_lib → ../../api/_lib
  //   ../../src/lib → ../lib
  // api/_handlers/auth/login.ts:
  //   ../../_lib → ../../../api/_lib
  //   ../../../src/lib → ../../lib
  // api/_handlers/v1/keys/[id].ts:
  //   ../../../_lib → ../../../../api/_lib
  //   ../../../../src/lib → ../../../lib

  const depth = rel.split("/").length - 1; // 0 for top, 1 for auth/, 2 for v1/keys/
  // to api/_lib from src/server/handlers + depth
  // src/server/handlers → ../../../api/_lib (depth 0)
  // src/server/handlers/auth → ../../../../api/_lib (depth 1)
  const upToRoot = "../".repeat(2 + depth); // handlers → server → src → root for depth 0: wait
  // path: src/server/handlers/X
  // depth 0 file: src/server/handlers/employees.ts → need ../../../api/_lib (handlers→server→src→root? handlers→server = .., server→src = ../.., src→root = ../../..)
  // so from handlers (depth 0): ../../../api/_lib
  // from handlers/auth (depth 1): ../../../../api/_lib
  // from handlers/v1/keys (depth 2): ../../../../../api/_lib

  // to src/lib from handlers:
  // depth 0: ../lib
  // depth 1: ../../lib
  // depth 2: ../../../lib

  let out = code;

  // Map any relative import that ends with /_lib/ or contains src/lib
  out = out.replace(
    /from\s+["']((?:\.\.\/)+)_lib\/([^"']+)["']/g,
    (_m, _dots, rest) => {
      const apiLib = `${"../".repeat(3 + depth)}api/_lib/${rest}`;
      return `from "${apiLib}"`;
    },
  );

  out = out.replace(
    /from\s+["']((?:\.\.\/)+)src\/lib\/([^"']+)["']/g,
    (_m, _dots, rest) => {
      // handlers → server → src/lib  => ../../lib (+1 per nested dir)
      const lib = `${"../".repeat(2 + depth)}lib/${rest}`;
      return `from "${lib}"`;
    },
  );

  return out;
}

if (!fs.existsSync(srcRoot)) {
  console.error("Missing", srcRoot);
  process.exit(1);
}

const files = walk(srcRoot);
console.log("Moving", files.length, "handlers…");

for (const file of files) {
  const rel = path.relative(srcRoot, file).split(path.sep).join("/");
  const dest = path.join(destRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let code = fs.readFileSync(file, "utf8");
  code = rewrite(code, rel);
  fs.writeFileSync(dest, code);
  console.log(" ", rel);
}

// Remove old _handlers
fs.rmSync(srcRoot, { recursive: true, force: true });

// Spot check
for (const s of ["employees.ts", "auth/login.ts", "v1/keys/[id].ts"]) {
  const p = path.join(destRoot, s);
  if (!fs.existsSync(p)) continue;
  const c = fs.readFileSync(p, "utf8");
  const imps = [...c.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  console.log("\n" + s);
  imps.slice(0, 10).forEach((i) => console.log(" ", i));
}

console.log("\nDone.");
