const fs = require('fs');
const file = 'src/app/features/produccion/produccion.component.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
    if(lines[i].includes('productosOrigenFraccionar')) {
        console.log("Matched at line: " + i);
        lines[i+1] = "    return this.productos().filter(p => p.tipoArticulo === 'Comodín' || p.tipoArticulo === 'Materia Prima');";
    }
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
