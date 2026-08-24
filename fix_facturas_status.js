const fs = require('fs');
const file = 'src/app/features/facturas/facturas.component.html';
let html = fs.readFileSync(file, 'utf8');

html = html.replace(
  /@if \(f\.estatus === 'Cancelada' \|\| f\.venta\?\.estatus === 'Cancelada' \|\| f\.venta\?\.estatus === 'Devuelta'\) \{/g,
  `@if (f.estatus === 'Cancelada') {`
);

fs.writeFileSync(file, html, 'utf8');
