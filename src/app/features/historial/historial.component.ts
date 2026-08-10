import { Component, signal, computed, OnInit } from '@angular/core';
import { ExportService } from '../../core/services/export.service';
import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketPrinterService } from '../../core/services/ticket-printer.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginacionComponent],
  templateUrl: './historial.component.html',
})
export class HistorialComponent implements OnInit {
  ventas = signal<any[]>([]);
  cargando = signal(false);
  fechaInicio = signal(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)); // Hoy local
  fechaFin = signal(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)); // Hoy local

  // Filtros
  filtroBusqueda = signal('');
  filtroCliente = signal('todos');
  filtroUsuario = signal('todos');

  clientesUnicos = computed(() => {
    const nombres = new Set<string>();
    this.ventas().forEach(v => {
      if (v.nombre) nombres.add(v.nombre);
    });
    return Array.from(nombres).sort();
  });

  usuariosUnicos = computed(() => {
    const nombres = new Set<string>();
    this.ventas().forEach(v => {
      if (v.usuarioNombre) nombres.add(v.usuarioNombre);
    });
    return Array.from(nombres).sort();
  });

  ventasFiltradas = computed(() => {
    let list = this.ventas();
    if (this.filtroCliente() !== 'todos') {
      list = list.filter(v => v.nombre === this.filtroCliente());
    }
    if (this.filtroUsuario() !== 'todos') {
      list = list.filter(v => (v.usuarioNombre || 'Sistema') === this.filtroUsuario());
    }
    const search = this.filtroBusqueda().toLowerCase().trim();
    if (search) {
      list = list.filter(v => 
        (v.nombre && v.nombre.toLowerCase().includes(search)) || 
        String(v.idCajaChica).includes(search) ||
        (v.folio && v.folio.toLowerCase().includes(search))
      );
    }
    return list;
  });


  // Paginación
  paginaActual = signal(1);
  tamanoPagina = signal(10);

  ventasPaginadas = computed(() => {
    const arr = this.ventasFiltradas();
    const index = (this.paginaActual() - 1) * this.tamanoPagina();
    return arr.slice(index, index + this.tamanoPagina());
  });

  totalPaginas = computed(() => {
    return Math.max(1, Math.ceil(this.ventasFiltradas().length / this.tamanoPagina()));
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

  ventasCompletadas = computed(() => this.ventasFiltradas().filter(v => v.tipo !== 'C').length);
  ventasCanceladas = computed(() => this.ventasFiltradas().filter(v => v.tipo === 'C').length);

  ventaSeleccionada = signal<any>(null);
  
  // Control de Modales de Alertas
  ventaACancelar = signal<any>(null);
  ventaADevolverParcial = signal<any>(null);
  cantidadesADevolver = signal<Record<number, number>>({});
  alertaMensaje = signal<{ tipo: 'exito' | 'error', texto: string } | null>(null);

  constructor(
    private http: HttpClient, 
    private router: Router, 
    public auth: AuthService,
    private printer: TicketPrinterService
  , public exportService: ExportService) {}

  isAdmin() {
    return this.auth.sesion()?.idPerfil === 1 || this.auth.sesion()?.idPerfil === 3;
  }

  isSoporte() {
    return this.auth.sesion()?.idPerfil === 3;
  }

  navegar(ruta: string) {
    this.router.navigate([ruta]);
  }

  ngOnInit() {
    this.cargarHistorial();
    this.cargarClientes();
  }

  clientes = signal<any[]>([]);
  mostrarModalFactura = signal(false);
  ventaAFacturar = signal<any>(null);
  datosFactura = { rfc: '', razonSocial: '', cp: '', regimen: '', usoCfdi: 'G03', clienteId: null as number | null };
  facturando = signal(false);

  cargarClientes() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/clientes`).subscribe({
      next: (data) => this.clientes.set(data),
      error: (err) => console.error('Error cargando clientes', err)
    });
  }

  abrirModalFactura(venta: any) {
    this.ventaAFacturar.set(venta);
    this.datosFactura = { rfc: '', razonSocial: '', cp: '', regimen: '', usoCfdi: 'G03', clienteId: null };
    
    // Auto-seleccionar si la venta ya tiene un cliente asociado
    if (venta.cliente && venta.cliente.idCliente) {
      this.datosFactura.clienteId = venta.cliente.idCliente;
      this.onClienteSeleccionado(venta.cliente.idCliente);
    }
    
    this.mostrarModalFactura.set(true);
  }

  cerrarModalFactura() {
    this.mostrarModalFactura.set(false);
    this.ventaAFacturar.set(null);
  }

  subiendoCsf = signal(false);

  onClienteSeleccionado(id: any) {
    const cid = Number(id);
    const cliente = this.clientes().find(c => c.idCliente === cid);
    if (cliente) {
      this.datosFactura.rfc = cliente.rfc;
      this.datosFactura.razonSocial = cliente.nombreCompleto;
      this.datosFactura.cp = cliente.cp;
      this.datosFactura.regimen = cliente.regimenFiscal;
      this.datosFactura.usoCfdi = cliente.usoCfdi || 'G03';
    } else {
      this.datosFactura.rfc = '';
      this.datosFactura.razonSocial = '';
      this.datosFactura.cp = '';
      this.datosFactura.regimen = '';
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.subiendoCsf.set(true);
    const fd = new FormData();
    fd.append('file', file);

    this.http.post<any>(`${environment.apiUrl}/pos/utils/parse-csf`, fd).subscribe({
      next: (res) => {
        this.subiendoCsf.set(false);
        if (res.success) {
          this.datosFactura.rfc = res.rfc || this.datosFactura.rfc;
          this.datosFactura.razonSocial = res.nombre || this.datosFactura.razonSocial;
          
          if (res.cp) {
            this.datosFactura.cp = res.cp;
          }
          if (res.regimenFiscal) {
            this.datosFactura.regimen = res.regimenFiscal;
          }
        } else {
          alert('Error al leer Constancia: ' + (res.error || 'Formato no reconocido'));
        }
      },
      error: () => {
        this.subiendoCsf.set(false);
        alert('Error conectando al servidor para procesar la Constancia.');
      }
    });
  }

  generarFactura() {
    if (!this.datosFactura.rfc || !this.datosFactura.razonSocial || !this.datosFactura.cp || !this.datosFactura.regimen) {
      this.alertaMensaje.set({ tipo: 'error', texto: 'Faltan datos fiscales del cliente para facturar.' });
      return;
    }

    
    this.facturando.set(true);
    const idVenta = this.ventaAFacturar().idVenta || this.ventaAFacturar().idCajaChica;
    
    const payload = {
      rfc: this.datosFactura.rfc,
      razonSocial: this.datosFactura.razonSocial,
      cp: this.datosFactura.cp,
      regimen: this.datosFactura.regimen,
      usoCfdi: this.datosFactura.usoCfdi
    };

    this.http.post(`${environment.apiUrl}/pos/facturar/${idVenta}`, payload).subscribe({
      next: (res: any) => {
        this.facturando.set(false);
        this.alertaMensaje.set({ tipo: 'exito', texto: '¡Factura generada exitosamente!' });
        this.cerrarModalFactura();
        this.cargarHistorial(); // Refrescar para ver que ya está facturada (si el backend lo guarda)
        if (res.factura && res.factura.urlPdf) {
          window.open(res.factura.urlPdf, '_blank');
        }
      },
      error: (err) => {
        console.error('Error al facturar', err);
        this.facturando.set(false);
        this.alertaMensaje.set({ tipo: 'error', texto: err.error?.message || 'Error al intentar generar la factura. Verifica los datos o la API Key.' });
      }
    });
  }

  irAFacturas() {
    this.router.navigate(['/facturas']);
  }

  cargarHistorial() {
    this.cargarClientes();
    this.cargando.set(true);
    const url = `${environment.apiUrl}/pos/ventas`;
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        // Filtrar por fecha localmente
        const fInicio = this.fechaInicio();
        const fFin = this.fechaFin();
        const filtrados = data.filter(v => {
          const f = v.fechaVenta?.substring(0, 10);
          return f >= fInicio && f <= fFin;
        });
        
        // Mapear al formato legacy
        const mapeados = filtrados.map(v => ({
          ...v,
          idCajaChica: v.idVenta,
          fecha: v.fechaVenta,
          hora: new Date(v.fechaVenta).toLocaleTimeString(),
          usuarioNombre: v.usuario?.nombreUsuario,
          nombre: v.cliente?.nombreCompleto || 'Cliente General',
          tipo: v.estatus === 'Cancelada' ? 'C' : 'V',
          tieneFactura: v.facturas && v.facturas.length > 0 && v.facturas.some((f: any) => f.estatus === 'Emitida'),
          facturaPdf: v.facturas && v.facturas.length > 0 ? v.facturas.find((f: any) => f.estatus === 'Emitida')?.urlPdf : null,
          total: v.totalPagado,
          detalles: v.detalles?.map((d: any) => ({
            ...d,
            idDetalle: d.idDetalle,
            concepto: d.producto?.nombre || 'Producto',
            importe: d.subtotal
          })) || []
        }));
        
        this.ventas.set(mapeados);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar historial', err);
        this.cargando.set(false);
      }
    });
  }

  verDetalles(venta: any) {
    this.ventaSeleccionada.set(venta);
  }

  confirmarCancelarVenta(venta: any) {
    this.ventaACancelar.set(venta);
  }

  ejecutarCancelacion() {
    const venta = this.ventaACancelar();
    if (!venta) return;

    this.ventaACancelar.set(null);
    this.cargando.set(true);
    
    // La cancelación de ventas se maneja a través del módulo de devoluciones
    // No existe un endpoint /cajachica - se usa /pos/devoluciones
    this.http.post(`${environment.apiUrl}/pos/devoluciones`, {
      idVenta: venta.idVenta || venta.idCajaChica,
      motivo: 'Cancelación de venta',
      tipo: 'Total'
    }).subscribe({
      next: () => {
        this.alertaMensaje.set({ tipo: 'exito', texto: 'La venta ha sido anulada exitosamente y los productos regresaron al inventario.' });
        this.cerrarModal();
        this.cargarHistorial(); // Refrescar historial
      },
      error: (err) => {
        console.error('Error al cancelar la venta:', err);
        this.alertaMensaje.set({ tipo: 'error', texto: 'Ocurrió un error de conexión al intentar anular la venta. Inténtalo de nuevo.' });
        this.cargando.set(false);
      }
    });
  }

  cancelarCancelacion() {
    this.ventaACancelar.set(null);
  }

  cerrarAlerta() {
    this.alertaMensaje.set(null);
  }

  cerrarModal() {
    this.ventaSeleccionada.set(null);
  }

  abrirDevolucionParcial(venta: any) {
    this.ventaADevolverParcial.set(venta);
    const map: Record<number, number> = {};
    venta.detalles.forEach((d: any) => map[d.idDetalle] = 0);
    this.cantidadesADevolver.set(map);
  }

  cerrarDevolucionParcial() {
    this.ventaADevolverParcial.set(null);
  }

  cambiarCantidadDevolucion(idDetalle: number, event: any, max: number) {
    let qty = Number(event.target.value);
    if (isNaN(qty) || qty < 0) qty = 0;
    if (qty > max) qty = max;
    this.cantidadesADevolver.update(v => ({ ...v, [idDetalle]: qty }));
    event.target.value = qty;
  }

  ejecutarDevolucionParcial() {
    const venta = this.ventaADevolverParcial();
    if (!venta) return;

    const cantidades = this.cantidadesADevolver();
    const devoluciones = Object.keys(cantidades)
      .map(k => ({ idDetalle: Number(k), cantidadADevolver: cantidades[Number(k)] }))
      .filter(d => d.cantidadADevolver > 0);

    if (devoluciones.length === 0) {
      this.alertaMensaje.set({ tipo: 'error', texto: 'Debes indicar al menos un producto a devolver' });
      return;
    }

    this.cargando.set(true);
    this.http.post<{ success: boolean, mensaje: string }>(`${environment.apiUrl}/pos/devoluciones`, {
      idVenta: venta.idVenta || venta.idCajaChica,
      motivo: 'Devolución parcial',
      items: devoluciones.map(d => {
        const detalle = venta.detalles?.find((det: any) => det.idDetalle === d.idDetalle);
        return {
          idProducto: detalle?.idProducto || detalle?.producto?.idProducto,
          nombre: detalle?.concepto || detalle?.producto?.nombre || 'Producto',
          cantidad: d.cantidadADevolver,
          precioUnitario: detalle?.precioUnitario || 0,
          destino: 'stock'
        };
      })
    }).subscribe({
      next: (res) => {
        this.alertaMensaje.set({ tipo: res.success ? 'exito' : 'error', texto: res.mensaje });
        this.cerrarDevolucionParcial();
        this.cerrarModal(); 
        this.cargarHistorial();
      },
      error: (err) => {
        console.error(err);
        const msg = err.error?.message || 'Ocurrió un error al procesar la devolución parcial.';
        this.alertaMensaje.set({ tipo: 'error', texto: msg });
        this.cargando.set(false);
      }
    });
  }

  imprimirTicket() {
    const venta = this.ventaSeleccionada();
    if (!venta) return;

    this.printer.imprimirTicketVenta({
      id: venta.idCajaChica,
      fecha: `${venta.fecha.split('T')[0]} ${venta.hora}`,
      nombreUsuario: venta.usuarioNombre || 'Sistema',
      nombreCliente: venta.nombre,
      descuento: 0, // En historial la DB no parece retornar descuento desglosado aún
      totalCobrado: venta.total,
      metodoPago: venta.metodoPago || 'Efectivo',
      productos: venta.detalles.map((d: any) => ({
        nombre: d.concepto,
        cantidad: d.cantidad,
        precioUnitario: d.importe / d.cantidad,
        subtotal: d.importe
      }))
    });
  }

  imprimirTodosLosTickets() {
    const list = this.ventasFiltradas();
    if (list.length === 0) {
      alert('No hay tickets para imprimir con los filtros actuales.');
      return;
    }

    // Usar el TicketPrinterService para imprimir un reporte
    let texto = `================================\n`;
    texto += `         REPORTE DE VENTAS       \n`;
    texto += `================================\n`;
    texto += `Fecha: ${this.fechaInicio()} al ${this.fechaFin()}\n`;
    texto += `Total Tickets: ${list.length}\n`;
    texto += `Completadas: ${this.ventasCompletadas()} | Canceladas: ${this.ventasCanceladas()}\n`;
    texto += `================================\n\n`;

    let granTotal = 0;
    list.forEach(v => {
      texto += `[${v.tipo === 'C' ? 'ANULADO' : 'OK'}] TKT-${v.idCajaChica} | ${v.hora}\n`;
      texto += `Cliente: ${v.nombre}\n`;
      if (v.tipo !== 'C') granTotal += Number(v.total);
      texto += `Total: $${Number(v.total).toFixed(2)}\n`;
      texto += `--------------------------------\n`;
    });

    texto += `\n================================\n`;
    texto += `GRAN TOTAL: $${granTotal.toFixed(2)}\n`;
    texto += `================================\n\n\n\n\n`;

    this.printer.imprimirTextoDirecto(texto);
  }

  exportarCSV() {
    const list = this.ventasFiltradas();
    if (list.length === 0) { alert('No hay ventas para exportar.'); return; }

    // Encabezados
    const headers = ['Folio', 'Fecha', 'Hora', 'Cliente', 'Cajero', 'Método Pago', 'Total', 'Estatus'];
    const rows = list.map(v => [
      `VTA-${v.idCajaChica}`,
      v.fecha?.split('T')[0] || this.fechaInicio(),
      v.hora || '',
      v.nombre || 'Público General',
      v.usuarioNombre || 'Sistema',
      v.metodoPago || 'Efectivo',
      Number(v.total).toFixed(2),
      v.tipo === 'C' ? 'Cancelada' : 'Completada'
    ]);

    const granTotal = list.filter(v => v.tipo !== 'C').reduce((s: number, v: any) => s + Number(v.total), 0);
    rows.push([]);
    rows.push(['', '', '', '', '', 'GRAN TOTAL', granTotal.toFixed(2), '']);

    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const bom = '\uFEFF'; // Para que Excel abra bien los acentos
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${this.fechaInicio()}_al_${this.fechaFin()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── DEVOLUCIONES ────────────────────────────────────────────
  mostrarModalDevolucion = signal(false);
  ventaParaDevolver = signal<any>(null);
  itemsDevolucion: { idProducto: number; nombre: string; cantidad: number; precioUnitario: number; seleccionado: boolean; maxCantidad: number; destino: 'stock' | 'merma' }[] = [];
  motivoDevolucion = '';
  observacionesDevolucion = '';
  guardandoDevolucion = signal(false);

  get montoDevolucion() {
    return this.itemsDevolucion
      .filter(i => i.seleccionado)
      .reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  }

  get headersHttp() {
    const s = this.auth.sesion();
    const h: any = {};
    if (s?.idSucursal) h['x-sucursal-id'] = String(s.idSucursal);
    if (s?.idUsuario) h['x-usuario-id'] = String(s.idUsuario);
    return h;
  }

  abrirModalDevolucion(venta: any) {
    this.ventaParaDevolver.set(venta);
    this.motivoDevolucion = '';
    this.observacionesDevolucion = '';
    this.itemsDevolucion = (venta.detalles || []).map((d: any) => ({
      idProducto: d.idProducto || d.producto?.idProducto,
      nombre: d.nombreProducto || d.producto?.nombre || 'Producto',
      cantidad: Number(d.cantidad),
      precioUnitario: Number(d.precioUnitario),
      seleccionado: true,
      maxCantidad: Number(d.cantidad),
      destino: 'stock'
    }));
    this.mostrarModalDevolucion.set(true);
  }

  confirmarDevolucion() {
    const items = this.itemsDevolucion.filter(i => i.seleccionado && i.cantidad > 0);
    if (!items.length) { alert('Selecciona al menos un producto para devolver'); return; }

    this.guardandoDevolucion.set(true);
    const payload = {
      idVenta: this.ventaParaDevolver()?.idVenta || this.ventaParaDevolver()?.idCajaChica,
      motivo: this.motivoDevolucion,
      observaciones: this.observacionesDevolucion,
      items: items.map(i => ({ 
        idProducto: i.idProducto, 
        nombre: i.nombre, 
        cantidad: i.cantidad, 
        precioUnitario: i.precioUnitario,
        destino: i.destino
      }))
    };

    this.http.post<any>(`${environment.apiUrl}/pos/devoluciones`, payload, { headers: this.headersHttp }).subscribe({
      next: (res) => {
        this.guardandoDevolucion.set(false);
        this.mostrarModalDevolucion.set(false);
        alert(`✅ Devolución registrada. Monto a devolver: $${Number(res.montoDevuelto).toFixed(2)}`);
        this.cargarHistorial();
      },
      error: (err) => {
        this.guardandoDevolucion.set(false);
        alert('Error al registrar la devolución: ' + (err.error?.message || 'Error desconocido'));
      }
    });
  }

  exportarExcel() {
    const data = this.ventasFiltradas().map((v: any) => ({
      'ID Venta': v.idVenta,
      'Fecha': new Date(v.fecha).toLocaleString(),
      'Total': v.total,
      'Método Pago': v.metodoPago,
      'Estatus': v.estatus,
      'Cajero': v.usuario?.nombre || v.usuarioNombre || 'N/A',
      'Cliente': v.cliente?.nombre || v.nombre || 'Público en General'
    }));
    this.exportService.exportToExcel(data, 'Historial_Ventas');
  }

  descargarPdf(url: string) {
    if(url) {
      if (url.startsWith('/pos/facturas')) {
        window.open(`${environment.apiUrl}${url}`, '_blank');
      } else {
        window.open(url, '_blank');
      }
    }
  }

  exportarPDF() {
    const headers = ['ID', 'Fecha', 'Total', 'Pago', 'Estatus', 'Cajero', 'Cliente'];
    const data = this.ventasFiltradas().map((v: any) => [
      v.idVenta.toString(),
      new Date(v.fecha).toLocaleString(),
      `$${v.total}`,
      v.metodoPago,
      v.estatus,
      v.usuario?.nombre || v.usuarioNombre || 'N/A',
      v.cliente?.nombre || v.nombre || 'Público'
    ]);
    this.exportService.exportToPdf(headers, data, 'Historial de Ventas', 'Historial_Ventas', 'l');
  }
}

