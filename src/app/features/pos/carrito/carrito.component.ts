import { Component, signal, OnInit, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../../core/services/pos.service';
import { AuthService } from '../../../core/services/auth.service';
import { Cliente } from '../../../core/interfaces';
import { TicketPrinterService } from '../../../core/services/ticket-printer.service';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ConfigService } from '../../../core/services/config.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carrito.component.html',
})
export class CarritoComponent implements OnInit {
  nuevoCliente = output<void>();
  toast = inject(ToastService);
  confirmService = inject(ConfirmService);
  configService = inject(ConfigService);

  clientes = signal<Cliente[]>([]);
  clienteSeleccionadoId = signal<string>('');
  cargando = signal(false);
  ventaExitosa = signal(false);
  ultimoTotal = signal(0);
  ultimoSubtotal = signal(0);
  ultimoIva = signal(0);
  ultimoMetodoPago = signal<string>('Efectivo');
  ultimoEfectivo = signal<number>(0);
  ultimoTarjeta = signal<number>(0);
  ultimoTransferencia = signal<number>(0);
  ultimoCambio = signal<number>(0);
  ultimoEfectivoRecibido = signal<number>(0);
  ultimoTicketItems = signal<any[]>([]);
  idUltimaVenta = signal<number | null>(null);
  folioUltimaVenta = signal<string | null>(null);
  
  // Custom Dropdown State
  dropdownAbierto = signal(false);
  busquedaCliente = signal('');

  // Descuentos y Venta
  tipoDescuento = signal<'cantidad' | 'porcentaje'>('cantidad');
  valorDescuento = signal<number>(0);
  
  descuentoGlobal = computed(() => {
    const total = this.pos.totalPagar();
    if (this.tipoDescuento() === 'porcentaje') {
      return (total * this.valorDescuento()) / 100;
    }
    return this.valorDescuento();
  });

  modalDescuentoAbierto = signal(false);
  inputDescuento = signal<number | null>(null);
  inputTipoDescuento = signal<'cantidad' | 'porcentaje'>('cantidad');

  totalPagarFinal = computed(() => Math.max(0, this.pos.totalPagar()));

  // Payment Modal State
  modalPagoAbierto = signal(false);
  pagoEfectivo = signal<number | null>(null);
  pagoTarjeta = signal<number | null>(null);
  pagoTransferencia = signal<number | null>(null);

  totalIngresado = computed(() => {
    return (this.pagoEfectivo() || 0) + (this.pagoTarjeta() || 0) + (this.pagoTransferencia() || 0);
  });

  cambio = computed(() => {
    const total = this.totalPagarFinal();
    const ingresado = this.totalIngresado();
    return Number((ingresado - total).toFixed(2));
  });

  // Ventas Pausadas Modal
  modalPausadasAbierto = signal(false);

  // Computed filtered list
  clientesFiltrados = computed(() => this.clientes());

  // Derived selected client name for the trigger button
  nombreClienteSeleccionado = computed(() => {
    const id = this.clienteSeleccionadoId();
    if (!id) return '— Público General —';
    const c = this.clientes().find(x => x.idCliente === +id);
    return c ? c.nombreCompleto : '— Público General —';
  });

  constructor(
    public pos: PosService, 
    public auth: AuthService,
    private printer: TicketPrinterService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarClientes();
  }

  cargarClientes(search: string = '') {
    this.pos.getClientes(1, 20, search).subscribe({
      next: (res: any) => {
        const clientes = res.data || [];
        const unicos: Cliente[] = [];
        const vistos = new Set<string>();
        for (const c of clientes) {
          const nombreLimpio = (c.nombreCompleto || '').trim().toUpperCase();
          if (!vistos.has(nombreLimpio)) {
            unicos.push(c);
            vistos.add(nombreLimpio);
          }
        }
        this.clientes.set(unicos);
      },
    });
  }

  busquedaClienteChanged(term: string) {
    this.busquedaCliente.set(term);
    this.cargarClientes(term);
  }

  toggleDropdown() {
    this.dropdownAbierto.update(v => !v);
    if (!this.dropdownAbierto()) {
      this.busquedaCliente.set(''); // Reset search on close
    }
  }

  seleccionarClienteDropdown(idStr: string) {
    this.clienteSeleccionadoId.set(idStr);
    this.dropdownAbierto.set(false);
    this.busquedaCliente.set('');
    
    if (!idStr) {
      this.pos.seleccionarCliente(null);
    } else {
      const cliente = this.clientes().find((c) => c.idCliente === +idStr) ?? null;
      this.pos.seleccionarCliente(cliente);
    }
  }

  agregarClienteALista(cliente: Cliente) {
    this.clientes.update((lista) => [...lista, cliente].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)));
    this.seleccionarClienteDropdown(String(cliente.idCliente));
  }

  async limpiarCarrito() {
    if (this.pos.carrito().length > 0) {
      const confirmed = await this.confirmService.confirm({ title: 'Vaciar Carrito', message: '¿Estás seguro de que deseas vaciar el carrito?', confirmText: 'Sí, vaciar', cancelText: 'Cancelar', isDanger: true });
    if (!confirmed) return;
    }
    this.pos.limpiarCarrito();
    this.clienteSeleccionadoId.set('');
    this.valorDescuento.set(0);
  }

  // --- Descuentos ---
  abrirModalDescuento() {
    if (this.auth.sesion()?.idPerfil !== 1) {
      this.toast.show('Solo los administradores pueden aplicar descuentos.', 'error');
      return;
    }
    this.inputTipoDescuento.set(this.tipoDescuento());
    this.inputDescuento.set(this.valorDescuento() || null);
    this.modalDescuentoAbierto.set(true);
  }

  cerrarModalDescuento() {
    this.modalDescuentoAbierto.set(false);
  }

  aplicarDescuento() {
    const desc = this.inputDescuento() || 0;
    if (desc < 0) {
      this.toast.show('El descuento no puede ser negativo.', 'warning');
      return;
    }

    let utilidadTotal = 0;
    this.pos.carrito().forEach(item => {
      const pPublico = Number(item.producto.precioPublico) || Number(item.producto.precioVenta) || Number(item.producto.precioUnitario) || 0;
      const pCompra = Number((item.producto as any).precioCompra) || 0;
      utilidadTotal += (pPublico - pCompra) * (Number(item.cantidad) || 0);
    });

    const utilidadDisponible = utilidadTotal - this.pos.totalDescuentos();

    let descuentoMonto = desc;
    if (this.inputTipoDescuento() === 'porcentaje') {
      if (desc > 100) {
        this.toast.show('El descuento no puede ser mayor al 100%.', 'warning');
        return;
      }
      descuentoMonto = (this.pos.totalPagar() * desc) / 100;
    }

    if (descuentoMonto > utilidadDisponible) {
      alert(`El descuento global ($${descuentoMonto.toFixed(2)}) supera la utilidad disponible de la venta ($${utilidadDisponible.toFixed(2)}). No se puede aplicar.`);
      return;
    }

    this.tipoDescuento.set(this.inputTipoDescuento());
    this.valorDescuento.set(desc);
    this.cerrarModalDescuento();
  }

  // --- Descuentos por Item ---
  modalDescuentoItemAbierto = signal(false);
  itemDescuentoSeleccionadoId = signal<string | null>(null);
  inputDescuentoItemValor = signal<number | null>(null);
  inputTipoDescuentoItem = signal<'cantidad' | 'porcentaje'>('cantidad');

  abrirModalDescuentoItem(uid: string, descuentoActual: number) {
    if (this.auth.sesion()?.idPerfil !== 1) {
      this.toast.show('Solo los administradores pueden aplicar descuentos.', 'error');
      return;
    }
    this.itemDescuentoSeleccionadoId.set(uid);
    this.inputDescuentoItemValor.set(descuentoActual || null);
    this.inputTipoDescuentoItem.set('cantidad'); // Default
    this.modalDescuentoItemAbierto.set(true);
  }

  cerrarModalDescuentoItem() {
    this.modalDescuentoItemAbierto.set(false);
    this.itemDescuentoSeleccionadoId.set(null);
  }

  aplicarDescuentoItem() {
    const id = this.itemDescuentoSeleccionadoId();
    if (!id) return;
    
    let desc = this.inputDescuentoItemValor() || 0;
    if (desc < 0) {
      this.toast.show('El descuento no puede ser negativo.', 'warning');
      return;
    }

    const itemEnCarrito = this.pos.carrito().find(i => i.uid === id);
    if (!itemEnCarrito) return;

    const qty = Number(itemEnCarrito.cantidad) || 0;
    const pPublico = Number(itemEnCarrito.producto.precioPublico) || Number(itemEnCarrito.producto.precioVenta) || Number(itemEnCarrito.producto.precioUnitario) || 0;
    const pCompra = Number((itemEnCarrito.producto as any).precioCompra) || 0;
    const utilidadTotalItem = (pPublico - pCompra) * qty;

    let descMonto = desc;
    if (this.inputTipoDescuentoItem() === 'porcentaje') {
      if (desc > 100) {
        this.toast.show('El descuento no puede ser mayor al 100%.', 'warning');
        return;
      }
      descMonto = (desc / 100) * (pPublico * qty); // Convierte porcentaje a cantidad monetaria
    }

    if (descMonto > utilidadTotalItem) {
      alert(`El descuento ($${descMonto.toFixed(2)}) supera la utilidad de este artículo ($${utilidadTotalItem.toFixed(2)}). No se puede aplicar.`);
      return;
    }

    this.pos.aplicarDescuentoAItem(id, descMonto);
    this.cerrarModalDescuentoItem();
  }

  // --- Ventas Pausadas ---
  pausarVentaActual() {
    if (this.pos.carrito().length === 0) return;
    this.pos.pausarVenta();
    this.valorDescuento.set(0);
    this.clienteSeleccionadoId.set('');
  }

  abrirModalPausadas() {
    this.modalPausadasAbierto.set(true);
  }

  cerrarModalPausadas() {
    this.modalPausadasAbierto.set(false);
  }

  async recuperarVentaPausada(id: number) {
    if (this.pos.carrito().length > 0) {
      const confirmed = await this.confirmService.confirm({ title: 'Venta Activa', message: 'Tienes una venta activa. ¿Deseas reemplazarla con esta venta pausada?', confirmText: 'Reemplazar', cancelText: 'Cancelar' });
      if (!confirmed) return;
    }
    this.pos.recuperarVenta(id);
    const c = this.pos.clienteSeleccionado();
    if (c) this.clienteSeleccionadoId.set(String(c.idCliente));
    else this.clienteSeleccionadoId.set('');
    this.cerrarModalPausadas();
  }

  async eliminarVentaPausada(id: number) {
    const confirmed = await this.confirmService.confirm({ title: 'Eliminar Venta Pausada', message: '¿Estás seguro de eliminar esta venta pausada?', confirmText: 'Eliminar', cancelText: 'Cancelar', isDanger: true });
    if (!confirmed) return;
    this.pos.eliminarVentaPausada(id);
  }

  cobrar() {
    if (this.pos.carrito().length === 0) return;
    this.pagoEfectivo.set(null);
      this.pagoTarjeta.set(null);
      this.pagoTransferencia.set(null);
    this.modalPagoAbierto.set(true);
  }
  
  cobroExacto() {
    this.pagoEfectivo.set(this.totalPagarFinal());
    this.pagoTarjeta.set(null);
    this.pagoTransferencia.set(null);
  }

  cerrarModalPago() {
    this.modalPagoAbierto.set(false);
    
  }

  confirmarCobro() {
    if (this.pos.carrito().length === 0) return;
    
    const aPagar = this.totalPagarFinal();
    const ingresado = this.totalIngresado();
    
    if (this.cambio() < 0) {
      // Not enough funds
      return;
    }

    this.cargando.set(true);

    const cliente = this.pos.clienteSeleccionado();
    
    const ef = this.pagoEfectivo() || 0;
    const tar = this.pagoTarjeta() || 0;
    const tr = this.pagoTransferencia() || 0;

    let primary = 'Efectivo';
    let maxAmt = ef;
    if (tar > maxAmt) { primary = 'Tarjeta'; maxAmt = tar; }
    if (tr > maxAmt) { primary = 'Transferencia'; maxAmt = tr; }

    const payload = {
      idCliente: cliente?.idCliente,
      nombreCliente: cliente?.nombreCompleto ?? 'PÚBLICO GENERAL',
      subtotal: this.pos.subtotal(),
      totalIva: this.pos.totalIva(),
      descuento: this.pos.totalDescuentos(),
      totalPagado: aPagar,
      idUsuario: this.auth.sesion()?.idUsuario,
      idSucursal: this.auth.sesion()?.idSucursal || 1,
      metodoPago: primary,
      montoEfectivo: Math.max(0, ef - Math.max(0, this.cambio())),
      montoTarjeta: tar,
      montoTransferencia: tr,
      efectivoRecibido: ef,
      cambioEntregado: Math.max(0, this.cambio()),
      carrito: this.pos.carrito().map((item) => ({
        idProducto: item.producto.idProducto,
        cantidad: item.cantidad,
        precioUnitario: Number(item.producto.precioPublico || item.producto.precioVenta || item.producto.precioUnitario || 0),
        descuento: item.descuento || 0,
        aplicaIva: item.producto.aplicaIva !== false,
        montoIva: item.producto.aplicaIva !== false ? (((Number((item.producto.precioPublico || item.producto.precioVenta || item.producto.precioUnitario)) * item.cantidad) - (item.descuento || 0)) * ((item.producto.iva !== undefined ? item.producto.iva : this.configService.config().ivaPorDefecto) / 100)) : 0,
      })),
    };

    this.ultimoTotal.set(payload.totalPagado);
    this.ultimoSubtotal.set(this.pos.subtotal());
    this.ultimoIva.set(this.pos.totalIva());
    this.ultimoMetodoPago.set(primary);
      this.ultimoEfectivo.set(payload.montoEfectivo);
      this.ultimoTarjeta.set(payload.montoTarjeta);
      this.ultimoTransferencia.set(payload.montoTransferencia);
      this.ultimoCambio.set(payload.cambioEntregado);
      this.ultimoEfectivoRecibido.set(payload.efectivoRecibido);
    this.ultimoTicketItems.set(payload.carrito.map(d => ({ producto: { nombre: this.pos.carrito().find(c => c.producto.idProducto === d.idProducto)?.producto.nombre || 'Producto', precioUnitario: d.precioUnitario, aplicaIva: d.aplicaIva }, cantidad: d.cantidad, descuento: d.descuento })));

      this.pos.checkout(payload).subscribe({
        next: (res: any) => {
          this.cargando.set(false);
          this.modalPagoAbierto.set(false);
          
          if (res && res.idVenta) {
            this.idUltimaVenta.set(res.idVenta);
            this.folioUltimaVenta.set(res.folio || null);
          }
          this.ventaExitosa.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.cargando.set(false);
          if (err.error?.message) {
            this.toast.show(err.error.message, 'error');
          } else {
            this.toast.show('Error al procesar la venta. Verifica la conexión con el servidor.', 'error');
          }
        },
      });
  }

  nuevaVenta() {
    this.ventaExitosa.set(false);
    this.idUltimaVenta.set(null);
    this.folioUltimaVenta.set(null);
    this.pos.limpiarCarrito();
    this.clienteSeleccionadoId.set('');
    this.valorDescuento.set(0);
  }

  irAFacturar() {
    const folio = this.folioUltimaVenta() || this.idUltimaVenta();
    if (folio) {
      this.nuevaVenta();
      this.router.navigate(['/facturas'], { queryParams: { facturarVenta: folio } });
    }
  }

  
  modificarPrecioItem(item: any) {
    if (!this.auth.tienePermiso('aplicar_descuentos')) {
      this.toast.show('No tienes permisos para modificar precios', 'error');
      return;
    }
    const currentPrice = item.producto.precioPublico || item.producto.precioVenta || item.producto.precioUnitario;
    const nuevo = window.prompt('Ingrese el nuevo precio unitario para ' + item.producto.nombre + ':', currentPrice);
    if (nuevo !== null && nuevo.trim() !== '') {
      const precioNum = parseFloat(nuevo);
      if (!isNaN(precioNum) && precioNum >= 0) {
        // Update product price locally
        item.producto.precioPublico = precioNum;
        item.producto.precioVenta = precioNum;
        item.producto.precioUnitario = precioNum;
        // Trigger pos service update
        this.pos.setCantidadExacta(item.uid, item.cantidad);
      }
    }
  }


  imprimirTicket() {
    const cliente = this.pos.clienteSeleccionado();
    const items = this.ultimoTicketItems().length > 0 ? this.ultimoTicketItems() : this.pos.carrito();
    const ventaSimulada = {
      folio: this.folioUltimaVenta() || '�ltima Venta',
      fecha: new Date().toLocaleString(),
      nombreUsuario: this.auth.sesion()?.usuario || 'Admin',
      nombreCliente: cliente?.nombreCompleto || 'PÚBLICO GENERAL',
      descuento: this.pos.totalDescuentos(),
      totalCobrado: this.ultimoTotal(),
      subtotal: this.ultimoTotal() > 0 ? this.ultimoSubtotal() : this.pos.subtotal(),
      totalIva: this.ultimoTotal() > 0 ? this.ultimoIva() : this.pos.totalIva(),
      metodoPago: this.ultimoMetodoPago(),
        efectivoRecibido: this.ultimoEfectivoRecibido(),
        cambio: this.ultimoCambio(),
        efectivo: this.ultimoEfectivo(),
        tarjeta: this.ultimoTarjeta(),
        transferencia: this.ultimoTransferencia(),
      productos: items.map((i: any) => ({
          nombre: i.producto.nombre,
          cantidad: i.cantidad,
          precioUnitario: (i.producto.precioPublico || i.producto.precioVenta || i.producto.precioUnitario),
          descuento: i.descuento || 0,
          subtotal: i.cantidad * (i.producto.precioPublico || i.producto.precioVenta || i.producto.precioUnitario),
          aplicaIva: i.producto.aplicaIva,
          iva: i.producto.iva !== undefined ? i.producto.iva : this.configService.config().ivaPorDefecto,
          producto: i.producto
        }))
    };
    
    this.printer.imprimirTicketVenta(ventaSimulada);
  }
}
