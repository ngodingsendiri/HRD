/**
 * Add .js to extensionless relative imports in server-side modules.
 * Vercel Node ESM requires explicit extensions: import './foo' fails,
 * import './foo.js' resolves to foo.ts/js.
 */
import fs from "fs";
import path from "path";

function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      walk(p, acc);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const files = [
  ...walk("src/lib"),
  ...walk("src/server"),
  ...walk("api"),
];

// Also types/constants if imported from server
for (const f of ["src/types.ts", "src/constants.ts"]) {
  if (fs.existsSync(f)) files.push(f);
}

let changed = 0;
const re = /from\s+(["'])(\.\.?\/[^"']+)\1/g;

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  const next = code.replace(re, (full, q, spec) => {
    if (
      spec.endsWith(".js") ||
      spec.endsWith(".json") ||
      spec.endsWith(".css") ||
      spec.endsWith(".ts") ||
      spec.endsWith(".tsx") ||
      spec.endsWith(".mjs") ||
      spec.endsWith(".cjs")
    ) {
      return full;
    }
    return `from ${q}${spec}.js${q}`;
  });
  if (next !== code) {
    fs.writeFileSync(file, next);
    changed++;
    console.log("fixed", file);
  }
}
console.log("files changed:", changed);
