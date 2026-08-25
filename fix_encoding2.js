const fs = require('fs');
const file = 'src/app/features/produccion/produccion.component.ts';
let content = fs.readFileSync(file, 'latin1'); // Read as latin1 to preserve weird bytes
content = content.replace(/Comod\ufffdn|Comod\xeen|Comod.n/g, 'Comodín');
fs.writeFileSync(file, content, 'utf8'); // Save as UTF-8!
