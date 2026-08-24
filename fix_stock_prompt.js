const fs = require('fs');
const file = 'src/app/core/services/pos.service.ts';
let ts = fs.readFileSync(file, 'utf8');

// Update agregarAlCarrito
ts = ts.replace(
`    if (!forzar) {
      const stockDisponible = this.stockActual()[producto.idProducto] || 0;
      if (stockDisponible <= 0) {
        this.solicitarConfirmacionStock(producto, 'vacio', () => this.agregarAlCarrito(producto, true, silent));
        return false;
      } else if (cantidadAumentada > stockDisponible) {
        this.solicitarConfirmacionStock(producto, 'excedido', () => this.agregarAlCarrito(producto, true, silent));
        return false;
      }
    }`,
`    if (!forzar) {
      const stockDisponible = this.stockActual()[producto.idProducto] || 0;
      // Skip prompt if they already accepted it for this product
      const yaAcepto = totalEnCarrito > Math.max(0, stockDisponible);
      if (!yaAcepto) {
        if (stockDisponible <= 0) {
          this.solicitarConfirmacionStock(producto, 'vacio', () => this.agregarAlCarrito(producto, true, silent));
          return false;
        } else if (cantidadAumentada > stockDisponible) {
          this.solicitarConfirmacionStock(producto, 'excedido', () => this.agregarAlCarrito(producto, true, silent));
          return false;
        }
      }
    }`
);

// Update cambiarCantidad
ts = ts.replace(
`      if (delta > 0 && !forzar) {
        const stockDisponible = this.stockActual()[itemEnCarrito.producto.idProducto] || 0;
        const totalEnCarrito = this._carrito()
          .filter(i => i.producto.idProducto === itemEnCarrito.producto.idProducto)
          .reduce((sum, i) => sum + i.cantidad, 0);
        const nuevaCantidadTotal = totalEnCarrito + delta;

        if (nuevaCantidadTotal > stockDisponible) {
          // If it was already at 0 or less, maybe show vacio? 
          // But if they are increasing, it's 'excedido' (or 'vacio' if 0)
          this.solicitarConfirmacionStock(itemEnCarrito.producto, stockDisponible <= 0 ? 'vacio' : 'excedido', () => this.cambiarCantidad(uid, delta, true));
          return false;
        }
      }`,
`      if (delta > 0 && !forzar) {
        const stockDisponible = this.stockActual()[itemEnCarrito.producto.idProducto] || 0;
        const totalEnCarrito = this._carrito()
          .filter(i => i.producto.idProducto === itemEnCarrito.producto.idProducto)
          .reduce((sum, i) => sum + i.cantidad, 0);
        const nuevaCantidadTotal = totalEnCarrito + delta;

        const yaAcepto = totalEnCarrito > Math.max(0, stockDisponible);
        if (nuevaCantidadTotal > stockDisponible && !yaAcepto) {
          this.solicitarConfirmacionStock(itemEnCarrito.producto, stockDisponible <= 0 ? 'vacio' : 'excedido', () => this.cambiarCantidad(uid, delta, true));
          return false;
        }
      }`
);

fs.writeFileSync(file, ts, 'utf8');
console.log("Replaced");
