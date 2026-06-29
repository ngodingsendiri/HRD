const fs = require('fs');
const path = require('path');

const employeeForm = path.join(__dirname, 'src/components/EmployeeForm.tsx');
let efContent = fs.readFileSync(employeeForm, 'utf8');
efContent = efContent.replace(/rounded-xl text-sm focus/g, 'rounded-lg text-sm focus');
fs.writeFileSync(employeeForm, efContent);

const settings = path.join(__dirname, 'src/pages/Settings.tsx');
let setContent = fs.readFileSync(settings, 'utf8');
setContent = setContent.replace(/rounded-xl/g, 'rounded-xl'); // wait, I need to check Settings
// In Settings, some are modals, some are inputs.
setContent = setContent.replace(/rounded-lg text-sm focus/g, 'rounded-lg text-sm focus'); 
// In settings, inputs already have rounded-lg.
fs.writeFileSync(settings, setContent);

console.log('Fixed files');
