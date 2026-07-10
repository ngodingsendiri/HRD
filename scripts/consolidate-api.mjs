/**
 * Move api/*.ts handlers (except _lib) into api/_handlers/
 * and rewrite relative imports for the extra directory depth.
 */
import fs from "fs";
import path from "path";

const root = "api";
const handlersRoot = path.join(root, "_handlers");

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === "_lib" || e.name === "_handlers") continue;
      walk(p, acc);
    } else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

function rewriteImports(code, fromFile) {
  // fromFile is under api/_handlers/...
  // Original was under api/... (one less segment)
  // We need to add one "../" to any relative import that goes to _lib or src
  return code.replace(
    /from\s+["'](\.\.[\/\\][^"']+)["']/g,
    (full, rel) => {
      // already relative parent — go one more level up
      const fixed = "../" + rel.replace(/\\/g, "/");
      return `from "${fixed}"`;
    },
  ).replace(
    /from\s+["'](\.\/_lib\/[^"']+)["']/g,
    (_full, rel) => {
      // ./_lib/foo → ../_lib/foo
      return `from ".${rel.replace(/^\./, ".")}"`.replace("./_lib", "../_lib");
    },
  );
}

// Better rewrite: compute depth of original path under api/
function rewriteImportsV2(code, relFromApi) {
  // relFromApi e.g. "employees.ts", "auth/login.ts", "v1/keys/[id].ts"
  // original imports:
  //   ./_lib → from api/
  //   ../_lib → from api/auth or api/v1 or api/employees
  //   ../../_lib → from api/v1/keys or api/employees
  //   ../../../src → deep
  // After move to api/_handlers/<same rel>:
  // need exactly +1 "../" on every relative import

  return code.replace(
    /from\s+["']((?:\.\.\/)+[^"']+|\.\/[^"']+)["']/g,
    (full, spec) => {
      if (spec.startsWith("./")) {
        // ./_lib/x → ../_lib/x
        return `from "../${spec.slice(2)}"`;
      }
      if (spec.startsWith("../")) {
        return `from "../${spec}"`;
      }
      return full;
    },
  );
}

const files = walk(root);
console.log("Moving", files.length, "endpoint files…");

for (const src of files) {
  const rel = path.relative(root, src).split(path.sep).join("/");
  const dest = path.join(handlersRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let code = fs.readFileSync(src, "utf8");
  code = rewriteImportsV2(code, rel);
  fs.writeFileSync(dest, code);
  fs.unlinkSync(src);
  console.log(" ", rel);
}

// Remove emptied directories
function rmEmpty(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (!e.isDirectory()) continue;
    if (e.name === "_lib" || e.name === "_handlers") continue;
    rmEmpty(p);
    const left = fs.readdirSync(p);
    if (left.length === 0) fs.rmdirSync(p);
  }
}
rmEmpty(root);

// Spot-check a few import paths
const samples = [
  "employees.ts",
  "auth/login.ts",
  "employees/[id].ts",
  "v1/keys/[id].ts",
];
for (const s of samples) {
  const p = path.join(handlersRoot, s);
  if (!fs.existsSync(p)) continue;
  const c = fs.readFileSync(p, "utf8");
  const imports = [...c.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  console.log("\n" + s + ":");
  for (const i of imports.slice(0, 8)) console.log("  ", i);
}

console.log("\nDone.");
