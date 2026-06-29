const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/EmployeeForm.tsx');
let content = fs.readFileSync(file, 'utf8');

// Use gap-6 instead of gap-5 for better breathing room in forms
content = content.replace(/gap-5/g, 'gap-6');

// make sure the form uses appropriate label colors
content = content.replace(/text-slate-700/g, 'text-slate-900'); // make labels slightly darker for contrast

fs.writeFileSync(file, content);
console.log('Fixed EmployeeForm gaps and contrast');
