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

  cambio = computed(() => {
    if (this.metodoPago() !== 'Efectivo') return 0;
    const recibido = this.cantidadRecibida() || 0;
    const total = this.totalPagarFinal();
    return Math.max(0, recibido - total);
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
    // Intercept with Payment Modal
    this.metodoPago.set('Efectivo');
    this.cantidadRecibida.set(null); // User must enter it, or we could default to total
    this.modalPagoAbierto.set(true);
  }
  
  cerrarModalPago() {
    this.modalPagoAbierto.set(false);
  }

  confirmarCobro() {
    if (this.pos.carrito().length === 0) return;
    
    // Prevent checkout if cash is insufficient
    if (this.metodoPago() === 'Efectivo') {
      const recibido = this.cantidadRecibida() || 0;
      if (recibido < this.totalPagarFinal()) {
        alert('La cantidad recibida es menor al total a pagar.');
        return;
      }
    }

    this.cargando.set(true);

    const cliente = this.pos.clienteSeleccionado();

    const payload = {
      idCliente: cliente?.idCliente,
      nombreCliente: cliente?.nombreCompleto ?? 'PÚBLICO GENERAL',
      subtotal: this.pos.subtotal(),
      totalIva: this.pos.totalIva(),
      descuento: this.descuentoGlobal(),
      totalPagado: this.totalPagarFinal(),
      idUsuario: this.auth.sesion()?.idUsuario,
      idSucursal: this.auth.sesion()?.idSucursal || 1, // Defaulting to 1 if not set
      metodoPago: this.metodoPago(),
      efectivoRecibido: this.metodoPago() === 'Efectivo' ? (this.cantidadRecibida() || this.totalPagarFinal()) : undefined,
      cambioEntregado: this.metodoPago() === 'Efectivo' ? this.cambio() : undefined,
      carrito: this.pos.carrito().map((item) => ({
        idProducto: item.producto.idProducto,
        cantidad: item.cantidad,
        precioUnitario: Number(item.producto.precioUnitario),
      })),
    };

    this.ultimoTotal.set(payload.totalPagado);
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
      descuento: this.descuentoGlobal(),
      totalCobrado: this.ultimoTotal(),
      metodoPago: this.metodoPago(),
      productos: items.map((i: any) => ({
        nombre: i.producto.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.producto.precioUnitario,
        subtotal: i.cantidad * i.producto.precioUnitario
      }))
    };
    
    this.printer.imprimirTicketVenta(ventaSimulada);
  }
}