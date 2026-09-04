const fs = require('fs');
const file = 'src/app/features/inventario/inventario.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/busqueda = signal\(''\);/, \usqueda = signal('');
  filtroFechaInicio = signal<string>('');
  filtroFechaFin = signal<string>('');
  filtroProducto = signal<number | null>(null);

  resumenPeriodo = computed(() => {
    if (!this.filtroProducto()) return null;
    const movs = this.registros();
    if (movs.length === 0) return null;

    const masAntiguo = movs[movs.length - 1];
    const masReciente = movs[0];

    const cantAntiguo = Number(masAntiguo.cantidad || 0);
    const tipoAntiguo = (masAntiguo.movimiento || '').toLowerCase();
    
    let factorAntiguo = 0;
    if (tipoAntiguo.includes('entrada') || tipoAntiguo.includes('compra') || tipoAntiguo.includes('ajuste (entrada)') || tipoAntiguo === 'traspaso_in' || tipoAntiguo === 'fraccionamiento_in' || tipoAntiguo === 'produccion_in' || tipoAntiguo === 'devolución (stock)') {
      factorAntiguo = 1;
    } else if (tipoAntiguo.includes('salida') || tipoAntiguo.includes('venta') || tipoAntiguo.includes('merma') || tipoAntiguo.includes('ajuste (salida)') || tipoAntiguo === 'traspaso_out' || tipoAntiguo === 'fraccionamiento_out' || tipoAntiguo === 'produccion_out') {
      if (!tipoAntiguo.includes('devolución (merma)')) {
        factorAntiguo = -1;
      }
    }
    
    const stockInicial = Number(masAntiguo.existenciaDespues || 0) - (cantAntiguo * factorAntiguo);
    const stockFinal = Number(masReciente.existenciaDespues || 0);

    let totalEntradas = 0;
    let totalSalidas = 0;

    movs.forEach(mov => {
      const tipo = (mov.movimiento || '').toLowerCase();
      const cant = Number(mov.cantidad || 0);
      
      let factor = 0;
      if (tipo.includes('entrada') || tipo.includes('compra') || tipo.includes('ajuste (entrada)') || tipo === 'traspaso_in' || tipo === 'fraccionamiento_in' || tipo === 'produccion_in' || tipo === 'devolución (stock)') {
        factor = 1;
      } else if (tipo.includes('salida') || tipo.includes('venta') || tipo.includes('merma') || tipo.includes('ajuste (salida)') || tipo === 'traspaso_out' || tipo === 'fraccionamiento_out' || tipo === 'produccion_out') {
        if (!tipo.includes('devolución (merma)')) {
          factor = -1;
        }
      }

      if (factor === 1) totalEntradas += cant;
      if (factor === -1) totalSalidas += cant;
    });

    return {
      stockInicial,
      totalEntradas,
      totalSalidas,
      stockFinal
    };
  });

  aplicarFiltrosKardex() {
    const activeTab = this.pestanaActiva();
    if (activeTab !== null) {
      this.cargarDatos(activeTab);
    }
  }\);

const exportExcelStr = \exportarExcel() {
    const data = this.registros().map((mov: any) => ({
      'Fecha': mov.fecha ? new Date(mov.fecha).toLocaleString() : 'N/A',
      'Concepto': mov.concepto || 'N/A',
      'Descripción': mov.descripcion || 'N/A',
      'Cantidad': mov.cantidad || 0,
      'Tipo': mov.movimiento || 'N/A',
      'Usuario': mov.usuario?.nombreUsuario || 'AdminPOS',
      'Costo U.': mov.costoUnitario || mov.precioUnitario || 0,
      'Total': (mov.cantidad || 0) * (mov.costoUnitario || mov.precioUnitario || 0),
      'Existencia Posterior': mov.existenciaDespues !== null && mov.existenciaDespues !== undefined ? mov.existenciaDespues : 'N/A'
    }));
    this.exportService.exportToExcel(data, 'Kardex_Movimientos');
  }\;
c = c.replace(/exportarExcel\(\) \{[\s\S]*?this\.exportService\.exportToExcel\(data, 'Kardex_Inventario'\);\s*\}/, exportExcelStr);

const exportPdfStr = \exportarPDF() {
    const headers = ['Fecha', 'Concepto', 'Descripción', 'Cant.', 'Tipo', 'Existencia'];
    const data = this.registros().map((mov: any) => [
      mov.fecha ? new Date(mov.fecha).toLocaleDateString() : 'N/A',
      mov.concepto || 'N/A',
      mov.descripcion || 'N/A',
      mov.cantidad || 0,
      mov.movimiento || 'N/A',
      mov.existenciaDespues !== null && mov.existenciaDespues !== undefined ? mov.existenciaDespues : 'N/A'
    ]);

    this.exportService.exportToPdf(
      headers,
      data,
      'Kardex de Movimientos',
      'Reporte detallado de movimientos de inventario',
      'Kardex_Movimientos'
    );
  }\;
c = c.replace(/exportarPDF\(\) \{[\s\S]*?'Kardex_Inventario'\s*\);\s*\}/, exportPdfStr);

const reverseStr = \eversarMovimiento(item: any) {
    this.menuAbiertoId.set(null);
    if (!confirm('¿Estás seguro de que deseas REVERSAR este movimiento? Se creará una contra-partida que afectará el inventario actual.')) return;
    
    const id = item.idMovimiento || this.getId(item);
    const tabId = this.pestanaActiva();
    
    this.http.post(\\\\/pos/inventario/movimiento/\/reversar\\\, {}).subscribe({
      next: () => {
        alert('Movimiento reversado exitosamente.');
        if (tabId !== null) this.cargarDatos(tabId);
      },
      error: (err) => {
        console.error('Error al reversar', err);
        alert(err.error?.message || 'Error al reversar el registro.');
      }
    });
  }

  imprimirVale(item: any) {\;
c = c.replace(/eliminarMovimiento\(item: any\) \{[\s\S]*?imprimirVale\(item: any\) \{/, reverseStr);

fs.writeFileSync(file, c);
console.log('patched');
