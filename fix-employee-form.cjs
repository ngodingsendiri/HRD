const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/EmployeeForm.tsx');
let content = fs.readFileSync(file, 'utf8');

// Tabs container
content = content.replace(
  /<div className="flex space-x-1 border-b border-slate-200">/g,
  '<div className="flex space-x-1 border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-hide">'
);

// Tab buttons
content = content.replace(
  /className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors \$\{/g,
  'className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all active:scale-95 ${'
);

// Bottom buttons
content = content.replace(
  /className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"/g,
  'className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all active:scale-95"'
);

content = content.replace(
  /className="px-6 py-2.5 text-sm font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-all"/g,
  'className="px-6 py-2.5 text-sm font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-all active:scale-95"'
);

content = content.replace(
  /className="px-6 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all"/g,
  'className="px-6 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all active:scale-95"'
);

// Other rounded-xl
content = content.replace(/rounded-xl bg-slate-50\/50/g, 'rounded-lg bg-slate-50/50');
content = content.replace(/rounded-xl text-sm text-slate-400/g, 'rounded-lg text-sm text-slate-400');

fs.writeFileSync(file, content);
console.log('Fixed EmployeeForm.tsx');
