const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, regex, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content);
}

replaceInFile(
  path.join(__dirname, 'src/pages/Ecosystem.tsx'),
  /rounded-md/g,
  'rounded-lg'
);
replaceInFile(
  path.join(__dirname, 'src/pages/Print.tsx'),
  /rounded-md/g,
  'rounded-lg'
);
replaceInFile(
  path.join(__dirname, 'src/pages/Dashboard.tsx'),
  /rounded-md/g,
  'rounded-lg'
);
replaceInFile(
  path.join(__dirname, 'src/components/ErrorBoundary.tsx'),
  /rounded-md/g,
  'rounded-lg'
);
replaceInFile(
  path.join(__dirname, 'src/components/Modal.tsx'),
  /rounded-sm/g,
  'rounded-lg'
);
replaceInFile(
  path.join(__dirname, 'src/components/Layout.tsx'),
  /rounded-md/g,
  'rounded-lg'
);

console.log('Fixed rounded-md/sm to rounded-lg');
