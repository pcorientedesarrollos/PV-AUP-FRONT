const fs = require('fs');
const file = 'src/app/features/produccion/produccion.component.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Comod.n/g, 'Comodín');
content = content.replace(/Materia Prima/g, 'Materia Prima');
content = content.replace(/v.lido/g, 'válido');
content = content.replace(/Est.s/g, 'Estás');
content = content.replace(/sumar.n/g, 'sumarán');
content = content.replace(/.xito/g, 'éxito');
content = content.replace(/Producci.n/g, 'Producción');
content = content.replace(/descontar.n/g, 'descontarán');

fs.writeFileSync(file, content, 'utf8');
