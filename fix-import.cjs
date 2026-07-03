const fs = require('fs');

let content = fs.readFileSync('src/pages/Employees.tsx', 'utf8');

// replace sisaCuti
content = content.replace(
  'sisaCutiN: String(getVal(row, ["Sisa Cuti N"]) || "").trim(),',
  'sisaCutiN: String(getVal(row, ["Sisa Cuti N", "Sisa Cuti Tahunan N"]) || "").trim(),'
);
content = content.replace(
  'sisaCutiN1: String(getVal(row, ["Sisa Cuti N-1"]) || "").trim(),',
  'sisaCutiN1: String(getVal(row, ["Sisa Cuti N-1", "Sisa Cuti Tahunan N1"]) || "").trim(),'
);
content = content.replace(
  'sisaCutiN2: String(getVal(row, ["Sisa Cuti N-2"]) || "").trim(),',
  'sisaCutiN2: String(getVal(row, ["Sisa Cuti N-2", "Sisa Cuti Tahunan N2"]) || "").trim(),'
);
content = content.replace(
  'skTerakhir: String(getVal(row, ["SK Terakhir"]) || "").trim(),',
  'skTerakhir: String(getVal(row, ["SK Terakhir", "SK Terakhir Yang Dimiliki"]) || "").trim(),'
);

// We should also replace the AI mapping fallback to use correct keys if needed. But it uses the object properties directly.

fs.writeFileSync('src/pages/Employees.tsx', content);
console.log('Fixed import getVal keys');
