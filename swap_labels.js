const fs = require('fs');
const path = require('path');

const base = 'c:/Users/EMMA/Desktop/ESTADIAS/PROYECTO AUP PUNTO DE VENTA/PV-AUP-FRONT';

const files = [
  'src/app/features/productos/productos.component.html',
  'src/app/features/productos/productos.component.ts',
  'src/app/features/compras/nueva-compra.component.ts',
  'src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.html',
  'src/app/features/inventario/inventario.ts',
  'src/app/features/pos/carrito/carrito.component.html',
  'src/app/features/pos/carrito/carrito.component.ts',
  'src/app/core/services/ticket-printer.service.ts',
];

files.forEach(f => {
  const fp = path.join(base, f);
  if (!fs.existsSync(fp)) { console.log('SKIP (not found): ' + fp); return; }

  let c = fs.readFileSync(fp, 'utf8');

  // Swap usando un token temporal para no hacer doble reemplazo
  // Paso 1: "Precio Público" → TOKEN_PUB
  // Paso 2: "Precio de Venta" / "Precio Venta" → las nuevas
  // Paso 3: TOKEN_PUB → "Precio de Venta"

  // Variantes de etiquetas de texto visible (no campos de BD)
  c = c.replace(/Precio Público/g, '__TEMP_PUBLICO__');
  c = c.replace(/PRECIO PÚBLICO/g, '__TEMP_PUBLICO_UP__');
  c = c.replace(/Precio P.blico/g, '__TEMP_PUBLICO__'); // caracteres raros
  c = c.replace(/PRECIO P.BLICO/g, '__TEMP_PUBLICO_UP__');

  c = c.replace(/Precio Venta Final/g, 'Precio Público');
  c = c.replace(/PRECIO VENTA FINAL/g, 'PRECIO PÚBLICO');
  c = c.replace(/Precio de Venta/g, 'Precio Público');
  c = c.replace(/PRECIO DE VENTA/g, 'PRECIO PÚBLICO');
  // "Precio Venta" sin "Final" - pero cuidado de no tocar variables de código
  // Solo en contexto de etiqueta (dentro de HTML texto, label, placeholder, title)
  c = c.replace(/Precio Venta(?!\s*\||\s*=|\s*\.|\.precioVenta)/g, 'Precio Público');
  c = c.replace(/PRECIO VENTA(?!\s*\||\s*=|\s*\.|\.precioVenta)/g, 'PRECIO PÚBLICO');

  c = c.replace(/__TEMP_PUBLICO__/g, 'Precio de Venta');
  c = c.replace(/__TEMP_PUBLICO_UP__/g, 'PRECIO DE VENTA');

  fs.writeFileSync(fp, c, 'utf8');
  console.log('UPDATED: ' + fp);
});

console.log('\nDone!');
