const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/EmployeeForm.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'overflow-x-auto whitespace-nowrap scrollbar-hide',
  'overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-px'
);

fs.writeFileSync(file, content);
console.log('Fixed scrollbar in EmployeeForm.tsx');
