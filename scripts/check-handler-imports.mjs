import fs from "fs";
import path from "path";

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

let bad = 0;
const files = walk("src/server/handlers");
for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  const imps = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  for (const i of imps) {
    if (!i.startsWith(".")) continue;
    const resolved = path.resolve(path.dirname(file), i.replace(/\.js$/, ".ts"));
    const ok = fs.existsSync(resolved);
    if (!ok) {
      console.log("MISSING", file, "->", i, "=>", resolved);
      bad++;
    }
  }
}
console.log(bad ? `FAIL ${bad} missing` : `OK ${files.length} handlers, all relative imports resolve`);
