const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/EmployeeForm.tsx');
let content = fs.readFileSync(file, 'utf8');

// The fields under dataKeluarga should be arranged better
content = content.replace(
  /<div className="grid grid-cols-1 md:grid-cols-6 gap-4">/g,
  '<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">'
);
content = content.replace(
  /<div className="space-y-1 md:col-span-2">\n<label className="text-xs font-medium text-slate-500">Nama<\/label>/g,
  '<div className="space-y-1">\n<label className="text-xs font-medium text-slate-500">Nama</label>'
);
content = content.replace(
  /<div className="space-y-1 md:col-span-2">\n<label className="text-xs font-medium text-slate-500">Keterangan<\/label>/g,
  '<div className="space-y-1 lg:col-span-3">\n<label className="text-xs font-medium text-slate-500">Keterangan</label>'
);

fs.writeFileSync(file, content);
console.log('Fixed EmployeeForm grids 2');
