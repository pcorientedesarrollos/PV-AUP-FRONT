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

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carrito.component.html',
})
export class CarritoComponent implements OnInit {
  nuevoCliente = output<void>();
  toast = inject(ToastService);

  clientes = signal<Cliente[]>([]);
  clienteSeleccionadoId = signal<string>('');
  cargando = signal(false);
  ventaExitosa = signal(false);
  ultimoTotal = signal(0);
  ultimoSubtotal = signal(0);
  ultimoIva = signal(0);
  ultimoTicketItems = signal<any[]>([]);
  
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

  totalPagarFinal = computed(() => {
    return Math.max(0, this.pos.totalPagar() - this.descuentoGlobal());
  });

  // Payment Modal State
  modalPagoAbierto = signal(false);
  metodoPago = signal<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  cantidadRecibida = signal<number | null>(null);
  
  // Para pago secundario (saldo restante)
  requierePagoSecundario = signal(false);
  metodoPagoSecundario = signal<'Tarjeta' | 'Transferencia' | null>(null);

  totalIngresado = computed(() => {
    if (this.metodoPago() !== 'Efectivo') {
       return this.cantidadRecibida() || this.totalPagarFinal();
    }
    // Si estamos en flujo secundario, asumimos que el restante lo cubrirá el 2do método
    if (this.requierePagoSecundario() && this.metodoPagoSecundario()) {
       return this.totalPagarFinal();
    }
    return this.cantidadRecibida() || 0;
  });

  cambio = computed(() => {
    const recibido = this.cantidadRecibida() || 0;
    const total = this.totalPagarFinal();
    
    // Si el usuario ingresa más que el total en efectivo, hay cambio
    if (this.metodoPago() === 'Efectivo' && recibido > total) {
       return Math.max(0, recibido - total);
    }
    return 0;
  });

  // Ventas Pausadas Modal
  modalPausadasAbierto = signal(false);

  // Computed filtered list
  clientesFiltrados = computed(() => {
    const term = this.busquedaCliente().trim().toLowerCase();
    if (!term) return this.clientes();
    return this.clientes().filter(c => c.nombreCompleto.toLowerCase().includes(term));
  });

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
    private printer: TicketPrinterService
  ) {}

  ngOnInit() {
    this.cargarClientes();
  }

  cargarClientes() {
    this.pos.getClientes().subscribe({
      next: (clientes) => {
        const unicos: Cliente[] = [];
        const vistos = new Set<string>();
        for (const c of clientes) {
          const nombreLimpio = c.nombreCompleto.trim().toUpperCase();
          if (!vistos.has(nombreLimpio)) {
            unicos.push(c);
            vistos.add(nombreLimpio);
          }
        }
        this.clientes.set(unicos);
      },
    });
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

  limpiarCarrito() {
    if (this.pos.carrito().length > 0) {
      if (!confirm('¿Estás seguro de que deseas vaciar el carrito?')) return;
    }
    this.pos.limpiarCarrito();
    this.clienteSeleccionadoId.set('');
    this.valorDescuento.set(0);
  }

  // --- Descuentos ---
  abrirModalDescuento() {
    if (this.auth.sesion()?.idPerfil !== 1) {
      alert('Solo los administradores pueden aplicar descuentos.');
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
      alert('El descuento no puede ser negativo.');
      return;
    }
    if (this.inputTipoDescuento() === 'porcentaje' && desc > 100) {
      alert('El descuento no puede ser mayor al 100%.');
      return;
    }
    if (this.inputTipoDescuento() === 'cantidad' && desc > this.pos.totalPagar()) {
      alert('El descuento no puede ser mayor al total de la venta.');
      return;
    }
    this.tipoDescuento.set(this.inputTipoDescuento());
    this.valorDescuento.set(desc);
    this.cerrarModalDescuento();
  }

  // --- Descuentos por Item ---
  modalDescuentoItemAbierto = signal(false);
  itemDescuentoSeleccionadoId = signal<number | null>(null);
  inputDescuentoItemValor = signal<number | null>(null);
  inputTipoDescuentoItem = signal<'cantidad' | 'porcentaje'>('cantidad');

  abrirModalDescuentoItem(idProducto: number, descuentoActual: number) {
    if (this.auth.sesion()?.idPerfil !== 1) {
      alert('Solo los administradores pueden aplicar descuentos.');
      return;
    }
    this.itemDescuentoSeleccionadoId.set(idProducto);
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
      alert('El descuento no puede ser negativo.');
      return;
    }

    const itemEnCarrito = this.pos.carrito().find(i => i.producto.idProducto === id);
    if (!itemEnCarrito) return;

    if (this.inputTipoDescuentoItem() === 'porcentaje') {
      if (desc > 100) {
        alert('El descuento no puede ser mayor al 100%.');
        return;
      }
      const qty = Number(itemEnCarrito.cantidad) || 0;
      const price = Number(itemEnCarrito.producto.precioUnitario) || 0;
      desc = (desc / 100) * (price * qty); // Convierte porcentaje a cantidad monetaria
    }

    this.pos.aplicarDescuentoAItem(id, desc);
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

  recuperarVentaPausada(id: number) {
    if (this.pos.carrito().length > 0) {
      if (!confirm('Tienes una venta activa. ¿Deseas reemplazarla?')) return;
    }
    this.pos.recuperarVenta(id);
    const c = this.pos.clienteSeleccionado();
    if (c) this.clienteSeleccionadoId.set(String(c.idCliente));
    else this.clienteSeleccionadoId.set('');
    this.cerrarModalPausadas();
  }

  eliminarVentaPausada(id: number) {
    if (!confirm('¿Estás seguro de eliminar esta venta pausada?')) return;
    this.pos.eliminarVentaPausada(id);
  }

  cobrar() {
    if (this.pos.carrito().length === 0) return;
    this.metodoPago.set('Efectivo');
    this.cantidadRecibida.set(null); 
    this.requierePagoSecundario.set(false);
    this.metodoPagoSecundario.set(null);
    this.modalPagoAbierto.set(true);
  }
  
  cerrarModalPago() {
    this.modalPagoAbierto.set(false);
    this.requierePagoSecundario.set(false);
    this.metodoPagoSecundario.set(null);
  }

  confirmarCobro() {
    if (this.pos.carrito().length === 0) return;
    
    const aPagar = this.totalPagarFinal();
    let isMixto = false;
    let efectivoIngresado = this.cantidadRecibida() || aPagar;
    
    if (this.metodoPago() === 'Efectivo') {
      const ingresado = this.cantidadRecibida() || 0;
      if (ingresado < (aPagar - 0.01)) {
        if (!this.requierePagoSecundario()) {
          // Cambiar al flujo de pago secundario
          this.requierePagoSecundario.set(true);
          return;
        } else {
          if (!this.metodoPagoSecundario()) {
            alert('Selecciona con qué método vas a pagar el saldo restante.');
            return;
          }
          isMixto = true;
          efectivoIngresado = ingresado;
        }
      }
    }

    this.cargando.set(true);

    const cliente = this.pos.clienteSeleccionado();
    const saldoRestante = aPagar - efectivoIngresado;

    const payload = {
      idCliente: cliente?.idCliente,
      nombreCliente: cliente?.nombreCompleto ?? 'PÚBLICO GENERAL',
      subtotal: this.pos.subtotal(),
      totalIva: this.pos.totalIva(),
      descuento: this.descuentoGlobal(),
      totalPagado: aPagar,
      idUsuario: this.auth.sesion()?.idUsuario,
      idSucursal: this.auth.sesion()?.idSucursal || 1, // Defaulting to 1 if not set
      metodoPago: isMixto ? 'Mixto' : this.metodoPago(),
      montoEfectivo: isMixto ? efectivoIngresado : (this.metodoPago() === 'Efectivo' ? aPagar : undefined),
      montoTarjeta: isMixto && this.metodoPagoSecundario() === 'Tarjeta' ? saldoRestante : (this.metodoPago() === 'Tarjeta' ? aPagar : undefined),
      montoTransferencia: isMixto && this.metodoPagoSecundario() === 'Transferencia' ? saldoRestante : (this.metodoPago() === 'Transferencia' ? aPagar : undefined),
      efectivoRecibido: this.metodoPago() === 'Efectivo' ? (this.cantidadRecibida() || aPagar) : undefined,
      cambioEntregado: this.cambio(),
      carrito: this.pos.carrito().map((item) => ({
        idProducto: item.producto.idProducto,
        cantidad: item.cantidad,
        precioUnitario: Number(item.producto.precioUnitario),
        descuento: item.descuento || 0,
      })),
    };

    this.ultimoTotal.set(payload.totalPagado);
    this.ultimoSubtotal.set(this.pos.subtotal());
    this.ultimoIva.set(this.pos.totalIva());
    this.ultimoTicketItems.set(payload.carrito.map(d => ({ producto: { nombre: this.pos.carrito().find(c => c.producto.idProducto === d.idProducto)?.producto.nombre || 'Producto', precioUnitario: d.precioUnitario }, cantidad: d.cantidad })));

      this.pos.checkout(payload).subscribe({
        next: () => {
          this.cargando.set(false);
          this.modalPagoAbierto.set(false);
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
    this.pos.limpiarCarrito();
    this.clienteSeleccionadoId.set('');
    this.valorDescuento.set(0);
  }

  imprimirTicket() {
    const cliente = this.pos.clienteSeleccionado();
    const items = this.ultimoTicketItems().length > 0 ? this.ultimoTicketItems() : this.pos.carrito();
    const ventaSimulada = {
      id: 'Última Venta',
      fecha: new Date().toLocaleString(),
      nombreUsuario: this.auth.sesion()?.usuario || 'Admin',
      nombreCliente: cliente?.nombreCompleto || 'PÚBLICO GENERAL',
      descuento: this.pos.totalDescuentos() + this.descuentoGlobal(),
      totalCobrado: this.ultimoTotal(),
      subtotal: this.ultimoTotal() > 0 ? this.ultimoSubtotal() : this.pos.subtotal(),
      totalIva: this.ultimoTotal() > 0 ? this.ultimoIva() : this.pos.totalIva(),
      metodoPago: this.metodoPago(),
      productos: items.map((i: any) => ({
        nombre: i.producto.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.producto.precioUnitario,
        descuento: i.descuento || 0,
        subtotal: i.cantidad * i.producto.precioUnitario
      }))
    };
    
    this.printer.imprimirTicketVenta(ventaSimulada);
  }
}