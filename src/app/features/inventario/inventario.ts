import { environment } from '../../../environments/environment';
import { Component, signal, OnInit, effect, computed } from '@angular/core';
import { ExportService } from '../../core/services/export.service';
import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TicketPrinterService } from '../../core/services/ticket-printer.service';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginacionComponent],
  templateUrl: './inventario.html',
})
export class InventarioComponent implements OnInit {
  vistaActiva = signal<'stock' | 'movimientos'>('movimientos');
  pestanas = signal<any[]>([]);
  pestanaActiva = signal<number | 'todos' | null>(null);
  
  registros = signal<any[]>([]);
  cargando = signal(false);

  // Filtros
  busqueda = signal('');
  filtroTipo = signal<string>('todos');

  registrosFiltrados = computed(() => {
    let list = this.registros();
    
    const tipo = this.filtroTipo();
    if (tipo !== 'todos') {
      list = list.filter(r => {
        const mov = (r.movimiento || 'Entrada').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return mov === tipo;
      });
    }

    const term = this.busqueda().toLowerCase();
    if (term) {
      list = list.filter(r => 
        (r.concepto || '').toLowerCase().includes(term) ||
        (r.descripcion || r.subcuenta || '').toLowerCase().includes(term) ||
        (r.codigoBarras || '').toLowerCase().includes(term) ||
        (r.idProducto?.toString() || '').includes(term)
      );
    }
    return list;
  });


  // Paginación para Movimientos
  paginaActual = signal(1);
  tamanoPagina = signal(10);

  registrosPaginados = computed(() => {
    const arr = this.registrosFiltrados();
    const index = (this.paginaActual() - 1) * this.tamanoPagina();
    return arr.slice(index, index + this.tamanoPagina());
  });

  totalPaginas = computed(() => {
    return Math.max(1, Math.ceil(this.registrosFiltrados().length / this.tamanoPagina()));
  });

  paginaAnterior() {
    if (this.paginaActual() > 1) {
      this.paginaActual.update(p => p - 1);
    }
  }

  paginaSiguiente() {
    if (this.paginaActual() < this.totalPaginas()) {
      this.paginaActual.update(p => p + 1);
    }
  }

  // Filtros Stock
  productosStockFiltrados = computed(() => {
    const tabId = this.pestanaActiva();
    let prods = this.catalogoProductos();
    
    if (tabId !== 'todos' && tabId !== null) {
      prods = prods.filter(p => {
        const id = p.categoria?.idCategoria || p.idCategoria;
        return id === tabId;
      });
    }

    const term = this.busqueda().toLowerCase();
    if (term) {
      prods = prods.filter(p => 
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.codigoBarras || '').toLowerCase().includes(term)
      );
    }
    return prods;
  });

  getBadgeColor(movimiento: string): string {
    const mov = (movimiento || 'Entrada').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (mov === 'entrada' || mov === 'compra') return 'bg-emerald-100 text-emerald-700';
    if (mov === 'salida') return 'bg-orange-100 text-orange-700';
    if (mov === 'devolucion') return 'bg-indigo-100 text-indigo-700';
    if (mov === 'ajuste') return 'bg-slate-100 text-slate-700';
    if (mov === 'merma') return 'bg-red-100 text-red-700 font-bold';
    return 'bg-amber-100 text-amber-700';
  }

  // Modal Entradas
  mostrarModal = signal(false);
  catalogoProductos = signal<any[]>([]);
  busquedaProductoModal = signal('');

  irAProductos() {
    this.router.navigate(['/productos'], { queryParams: { modal: 'nuevo' } });
  }
  nuevaEntrada = {
    idProducto: null,
    cantidad: null as number | null,
    costoUnitario: null as number | null,
    proveedor: '',
    tipoMovimiento: 'Compra',
    actualizarCosto: false
  };

  tiposEntrada = ['Compra', 'Ajuste Positivo', 'Devolución de Cliente', 'Otro'];

  // Modal Ajuste de Stock
  mostrarModalAjuste = signal(false);
  guardandoAjuste = signal(false);
  busquedaAjuste = '';
  ajuste: any = { idProducto: null, stockActual: 0, stockReal: null, motivo: '' };

  // Modal Merma
  mostrarModalMerma = signal(false);
  guardandoMerma = signal(false);
  busquedaMerma = '';
  merma: any = { idProducto: null, stockActual: 0, cantidad: null, motivo: 'Caducidad' };
  motivosMerma = ['Caducidad', 'Roto/Dañado', 'Robo/Extravío', 'Consumo Interno', 'Otro'];

  // Acciones: Estado
  menuAbiertoId = signal<number | null>(null);
  
  mostrarModalEditar = signal(false);
  itemAEditar: any = {};

  mostrarModalDetalles = signal(false);
  itemDetalles: any = null;

  constructor(
    private http: HttpClient, 
    private router: Router,
    private printer: TicketPrinterService
  , public exportService: ExportService) {
    effect(() => {
      const activeTab = this.pestanaActiva();
      if (activeTab !== null) {
        this.cargarDatos(activeTab);
      }
    });
  }

  navegar(ruta: string) {
    this.router.navigate([ruta]);
  }

  ngOnInit() {
    this.cargarCategorias();
    this.cargarCatalogo();
  }

  cargarCategorias() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/categorias`).subscribe({
      next: (data) => {
        const activas = data.filter(c => c.activo !== false);
        this.pestanas.set([{ idCategoria: 'todos', nombre: 'TODOS' }, ...activas]);
        this.pestanaActiva.set('todos');
      },
      error: (err) => (function(...args: any[]){})('Error al cargar categorias', err)
    });
  }

  cambiarPestana(idCategoria: number | 'todos') {
    this.pestanaActiva.set(idCategoria);
  }

  cargarCatalogo() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/productos`).subscribe({
      next: (data) => {
        const unicos = [];
        const vistos = new Set<string>();
        for (const p of data) {
          const nombreLimpio = p.nombre.trim().toUpperCase();
          if (!vistos.has(nombreLimpio)) {
            unicos.push(p);
            vistos.add(nombreLimpio);
          }
        }
        this.catalogoProductos.set(unicos);
      },
      error: (err) => (function(...args: any[]){})('Error al cargar catálogo', err)
    });
  }

  abrirModalEntrada() {
    this.mostrarModal.set(true);
    this.busquedaProductoModal.set('');
    this.nuevaEntrada = { 
      idProducto: null, 
      cantidad: null, 
      costoUnitario: null, 
      proveedor: '',
      tipoMovimiento: 'Compra',
      actualizarCosto: false
    };
  }

  cerrarModal() {
    this.mostrarModal.set(false);
  }

  abrirModalAjuste() {
    this.ajuste = { idProducto: null, stockActual: 0, stockReal: null, motivo: '' };
    this.busquedaAjuste = '';
    this.mostrarModalAjuste.set(true);
  }

  cerrarModalAjuste() {
    this.mostrarModalAjuste.set(false);
  }

  getProductosAjusteFiltrados() {
    const term = (this.busquedaAjuste || '').toLowerCase().trim();
    const prods = this.catalogoProductos();
    if (!term) return prods;
    return prods.filter(p => p.nombre.toLowerCase().includes(term));
  }

  onProductoAjusteChange(idProducto: number) {
    const prod = this.catalogoProductos().find(p => p.idProducto === idProducto);
    if (prod) {
      this.ajuste.stockActual = Number(prod.stockActual);
      this.ajuste.stockReal = null;
    }
  }

  guardarAjuste() {
    if (!this.ajuste.idProducto) { alert('Selecciona un producto.'); return; }
    if (this.ajuste.stockReal === null || this.ajuste.stockReal === undefined) { alert('Ingresa el stock real.'); return; }
    this.guardandoAjuste.set(true);

    this.http.post(`${environment.apiUrl}/pos/inventario/ajuste`, {
      idProducto: this.ajuste.idProducto,
      stockReal: Number(this.ajuste.stockReal),
      motivo: this.ajuste.motivo || 'Ajuste Manual'
    }).subscribe({
      next: (res: any) => {
        this.guardandoAjuste.set(false);
        this.cerrarModalAjuste();
        this.cargarCatalogo(); // Refresca el catalogo con nuevo stock
        
        const activeTab = this.pestanaActiva();
        if (activeTab !== null) {
          this.cargarDatos(activeTab); // Refresca los movimientos
        }
        alert(`✅ Ajuste aplicado. Stock anterior: ${res.stockAnterior} → Stock nuevo: ${res.stockNuevo}`);
      },
      error: (err) => {
        (function(...args: any[]){})('Error al ajustar stock', err);
        this.guardandoAjuste.set(false);
        alert('Ocurrió un error al aplicar el ajuste.');
      }
    });
  }

  getProductosModalFiltrados() {
    const base = this.catalogoProductos();
    const term = this.busquedaProductoModal().toLowerCase().trim();
    if (!term) return base;
    return base.filter(p => (p.nombre || '').toLowerCase().includes(term) || (p.codigoBarras || '').toLowerCase().includes(term));
  }

  guardarEntrada() {
    if (!this.nuevaEntrada.idProducto || !this.nuevaEntrada.cantidad || !this.nuevaEntrada.tipoMovimiento) {
      alert('Por favor completa todos los campos obligatorios (Producto, Cantidad y Tipo).');
      return;
    }

    const payload = {
      idProducto: this.nuevaEntrada.idProducto,
      cantidad: this.nuevaEntrada.cantidad,
      referencia: this.nuevaEntrada.proveedor || this.nuevaEntrada.tipoMovimiento,
      tipoMovimiento: this.nuevaEntrada.tipoMovimiento,
      costoUnitario: this.nuevaEntrada.costoUnitario,
      actualizarCosto: this.nuevaEntrada.actualizarCosto
    };

    this.http.post(`${environment.apiUrl}/pos/inventario/entradas`, payload).subscribe({
      next: () => {
        this.cerrarModal();
        const activeTab = this.pestanaActiva();
        if (activeTab !== null) {
          this.cargarDatos(activeTab); // Recargar tabla
        }
        alert('Entrada de inventario registrada con éxito');
      },
      error: (err) => {
        (function(...args: any[]){})('Error al guardar entrada', err);
        alert('Hubo un error al registrar la entrada.');
      }
    });
  }

  cargarDatos(tabId: number | 'todos') {
    this.cargando.set(true);

    this.http.get<any[]>(`${environment.apiUrl}/pos/inventario`).subscribe({
      next: (data) => {
        const formateados = data.map(mov => ({
          ...mov,
          idProducto: mov.producto?.idProducto,
          concepto: mov.referencia,
          descripcion: mov.producto?.nombre,
          cantidad: mov.cantidad,
          movimiento: mov.tipoMovimiento,
          idCategoria: mov.producto?.categoria?.idCategoria,
          codigoBarras: mov.producto?.codigoBarras
        }));

        // Filtrar en el frontend por la categoría activa (pestaña) si no es 'todos'
        const filtrados = tabId === 'todos' 
          ? formateados 
          : formateados.filter(item => item.idCategoria === tabId);

        this.registros.set(filtrados);
        this.cargando.set(false);
      },
      error: (err) => {
        (function(...args: any[]){})('Error al cargar datos de inventario', err);
        this.registros.set([]);
        this.cargando.set(false);
      }
    });
  }

  // ─── Lógica de Acciones (3 puntitos) ──────────────────────────

  getId(item: any) {
    return item.idAlmacen || item.idProductoDerivado || item.idDetalleEntrada || item.idMovimiento;
  }

  toggleMenu(item: any) {
    const id = this.getId(item);
    if (this.menuAbiertoId() === id) {
      this.menuAbiertoId.set(null);
    } else {
      this.menuAbiertoId.set(id);
    }
  }

  // 1. Editar
  abrirEditar(item: any) {
    this.itemAEditar = { ...item };
    this.mostrarModalEditar.set(true);
    this.menuAbiertoId.set(null);
  }

  cerrarModalEditar() {
    this.mostrarModalEditar.set(false);
  }

  guardarEdicion() {
    const id = this.itemAEditar.idMovimiento || this.getId(this.itemAEditar);
    const tabId = this.pestanaActiva();
    const endpoint = `${environment.apiUrl}/pos/inventario/movimiento`;

    this.http.patch(`${endpoint}/${id}`, this.itemAEditar).subscribe({
      next: () => {
        this.cerrarModalEditar();
        if (tabId !== null) this.cargarDatos(tabId);
      },
      error: (err) => alert('Error al editar el registro.')
    });
  }

  // 2. Eliminar / Anular
  eliminarMovimiento(item: any) {
    if (!confirm('¿Estás seguro de que deseas anular/eliminar este movimiento? Esto afectará el stock general permanentemente.')) return;
    
    const id = item.idMovimiento || this.getId(item);
    const tabId = this.pestanaActiva();
    const endpoint = `${environment.apiUrl}/pos/inventario/movimiento`;

    this.http.delete(`${endpoint}/${id}`).subscribe({
      next: () => {
         if (tabId !== null) this.cargarDatos(tabId);
      },
      error: (err) => alert('Error al eliminar el registro.')
    });
    this.menuAbiertoId.set(null);
  }

  imprimirVale(item: any) {
    this.menuAbiertoId.set(null);
    const id = this.getId(item);
    const cant = item.cantidad || item.entradas || 0;
    const costo = item.costoUnitario || item.precioUnitario || 0;
    
    const tabId = this.pestanaActiva();
    const tabName = this.pestanas().find(c => c.idCategoria === tabId)?.nombre || 'General';

    this.printer.imprimirValeAlmacen({
      almacen: tabName,
      id: id,
      concepto: item.concepto || 'S/N',
      descripcion: item.descripcion || item.subcuenta,
      tipo: item.movimiento || 'Entrada',
      cantidad: cant,
      costoUnitario: costo,
      importe: item.importe || 0
    });
  }

  // 4. Detalles
  abrirDetalles(item: any) {
    this.itemDetalles = item;
    this.mostrarModalDetalles.set(true);
    this.menuAbiertoId.set(null);
  }

  cerrarModalDetalles() {
    this.mostrarModalDetalles.set(false);
  }

  // 5. Ir al Catálogo
  irAlCatalogo() {
    this.menuAbiertoId.set(null);
    this.router.navigate(['/productos']);
  }

  // --- MERMAS ---
  abrirModalMerma() {
    this.merma = { idProducto: null, stockActual: 0, cantidad: null, motivo: 'Caducidad' };
    this.busquedaMerma = '';
    this.mostrarModalMerma.set(true);
  }

  cerrarModalMerma() {
    this.mostrarModalMerma.set(false);
  }

  getProductosMermaFiltrados() {
    const term = (this.busquedaMerma || '').toLowerCase().trim();
    const prods = this.catalogoProductos();
    if (!term) return prods;
    return prods.filter(p => p.nombre.toLowerCase().includes(term));
  }

  onProductoMermaChange(idProducto: number) {
    const prod = this.catalogoProductos().find(p => p.idProducto === idProducto);
    if (prod) {
      this.merma.idProducto = idProducto;
      this.merma.stockActual = Number(prod.stockActual);
      this.merma.cantidad = null;
    }
  }

  guardarMerma() {
    if (!this.merma.idProducto) { alert('Selecciona un producto.'); return; }
    if (!this.merma.cantidad || this.merma.cantidad <= 0) { alert('Ingresa una cantidad válida mayor a 0.'); return; }
    if (this.merma.cantidad > this.merma.stockActual) { alert('La cantidad de merma no puede ser mayor al stock actual.'); return; }
    
    this.guardandoMerma.set(true);

    this.http.post(`${environment.apiUrl}/pos/inventario/merma`, {
      idProducto: this.merma.idProducto,
      cantidad: Number(this.merma.cantidad),
      motivo: this.merma.motivo
    }).subscribe({
      next: (res: any) => {
        this.guardandoMerma.set(false);
        this.cerrarModalMerma();
        this.cargarCatalogo(); // Refresca el catalogo con nuevo stock
        
        const activeTab = this.pestanaActiva();
        if (activeTab !== null) {
          this.cargarDatos(activeTab); // Refresca los movimientos
        }
        alert(`✔️ Merma registrada. Stock descontado: ${this.merma.cantidad}. Pérdida costeada: $${res.costoPerdido}`);
      },
      error: (err) => {
        (function(...args: any[]){})('Error al registrar merma', err);
        this.guardandoMerma.set(false);
        alert('Ocurrió un error al registrar la merma.');
      }
    });
  }

  exportarExcel() {
    const data = this.productosStockFiltrados().map((p: any) => ({
      'Código': p.codigoBarras || 'N/A',
      'Producto': p.nombre || 'N/A',
      'Categoría': p.categoria?.nombre || 'N/A',
      'Stock Actual': p.stockActual || 0,
      'Precio Venta': p.precioPublico || 0,
      'Costo': p.precioUnitario || 0,
      'Sucursal': p.sucursal?.nombre || 'N/A'
    }));
    this.exportService.exportToExcel(data, 'Cardex_Inventario');
  }

  exportarPDF() {
    const headers = ['Código', 'Producto', 'Categoría', 'Stock', 'Precio', 'Costo', 'Sucursal'];
    const data = this.productosStockFiltrados().map((p: any) => [
      p.codigoBarras || 'N/A',
      p.nombre || 'N/A',
      p.categoria?.nombre || 'N/A',
      p.stockActual?.toString() || '0',
      `$${p.precioPublico || 0}`,
      `$${p.precioUnitario || 0}`,
      p.sucursal?.nombre || 'N/A'
    ]);
    this.exportService.exportToPdf(headers, data, 'Reporte de Inventario (Cardex)', 'Cardex_Inventario', 'l');
  }
}
