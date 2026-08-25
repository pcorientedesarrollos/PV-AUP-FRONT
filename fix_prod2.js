const fs = require('fs');
const file = 'src/app/features/produccion/produccion.component.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Comod[^n]?n/g, 'Comodín');

fs.writeFileSync(file, content, 'utf8');
