import { environment } from '../../../../environments/environment';
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { PosService } from '../../../core/services/pos.service';
import { ConfigService } from '../../../core/services/config.service';
import { ClienteRapidoComponent } from '../../pos/cliente-rapido/cliente-rapido.component';

@Component({
  selector: 'app-nueva-cotizacion',
  standalone: true,
  imports: [CommonModule, FormsModule, ClienteRapidoComponent],
  templateUrl: './nueva-cotizacion.html'
})
export class NuevaCotizacionComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private posService = inject(PosService);
  private configService = inject(ConfigService);

  clientes = signal<any[]>([]);

  // Form State
  idCliente = signal<number | null>(null);
  clienteBuscado = signal<string>('');
  mostrarDropdownClientes = signal<boolean>(false);
  mostrarNuevoCliente = signal<boolean>(false);
  fechaCotizacion = signal<string>(new Date().toISOString().split('T')[0]);
  titulo = signal<string>('');
  observaciones = signal<string>('');
  aplicarIva = signal<boolean>(false); // Starts false as requested
  
  tipoCambio = signal<number>(18.50);
  utilidadGlobal = signal<number>(0);

  // Carrito
  carrito = signal<any[]>([]);
  busquedaProducto = signal<string>('');
  conceptosFacturados = signal<any[]>([]);
  buscandoConceptos = signal<boolean>(false);
  
  guardando = signal(false);

  ngOnInit() {
    this.cargarClientes();
    this.cargarTipoCambio();
    }

  cargarClientes(search: string = '') {
    this.posService.getClientes(1, 20, search).subscribe((res: any) => {
      const data = res.data || [];
      this.clientes.set(data);
      this.clientesFiltrados.set(data);
    });
  }
  
  cargarTipoCambio() {
    this.http.get<any>(`${environment.apiUrl}/pos/tipo-cambio`).subscribe({
      next: (data) => {
        if (data && data.mxn) {
          this.tipoCambio.set(data.mxn);
          this.actualizarFila();
          this.toast.show('Tipo de cambio actualizado', 'success');
        }
      }
    });
  }

  clientesFiltrados = signal<any[]>([]);

  seleccionarClienteDropdown(cliente: any) {
    this.idCliente.set(cliente.idCliente);
    this.clienteBuscado.set(cliente.nombreCompleto);
    this.mostrarDropdownClientes.set(false);
  }
  
  onClienteInput() {
    this.idCliente.set(null);
  }

  productosFiltrados = signal<any[]>([]);

  agregarAlCarrito(producto: any) {
    const current = this.carrito();
    const existe = current.find(item => item.idProducto === producto.idProducto);
    
    if (existe) {
      existe.cantidad++;
      this.recalcularFila(existe);
      this.carrito.set([...current]);
    } else {
      const pUnit = Number(producto.precioUnitario) || 0;
      const tieneIva = producto.aplicaIva !== undefined ? producto.aplicaIva : this.aplicarIva();
      const fila = {
        tempId: Date.now() + Math.random(),
        idProducto: producto.idProducto,
        nombre: producto.nombre,
        cantidad: 1,
        precioCompra: pUnit,
        aplicaIva: tieneIva,
        iva: Number(producto.iva) || 16,
        moneda: 'MXN', 
        tipoCambio: this.tipoCambio(),
        utilidadPorcentaje: this.utilidadGlobal(),
        ganancia: 0,
        precioVenta: pUnit
      };
      this.recalcularFila(fila);
      this.carrito.set([...current, fila]);
      this.revisarEstadoGlobalIva();
    }
    this.busquedaProducto.set('');
  }

  onClienteCreado(cliente: any) {
    this.mostrarNuevoCliente.set(false);
    this.clientes.set([...this.clientes(), cliente]);
    this.idCliente.set(cliente.idCliente);
    this.toast.show('Cliente seleccionado', 'success');
  }

  agregarConceptoManual() {
    const current = this.carrito();
    const fila = {
      tempId: Date.now() + Math.random(),
      nombreConcepto: '',
      cantidad: 1,
      precioCompra: 0,
      aplicaIva: this.aplicarIva(),
      iva: this.configService.config().ivaPorDefecto || 16,
      moneda: 'MXN',
      tipoCambio: this.tipoCambio(),
      utilidadPorcentaje: this.utilidadGlobal(),
      ganancia: 0,
      precioVenta: 0,
      showSearch: false,
      searchResults: []
    };
    this.recalcularFila(fila);
    this.carrito.set([...current, fila]);
    this.revisarEstadoGlobalIva();
  }

  onManualSearch(item: any) {
    const term = (item.nombreConcepto || '').toLowerCase().trim();
    if (!term || term.length < 2) {
      item.searchResults = [];
      return;
    }
    item.searchResults = this.posService.productos().filter(p => 
      (p.nombre && p.nombre.toLowerCase().includes(term)) ||
      (p.codigoBarras && p.codigoBarras.toLowerCase().includes(term))
    ).slice(0, 10);
  }

  onManualBlur(item: any) {
    setTimeout(() => {
      item.showSearch = false;
    }, 200);
  }

  seleccionarProductoFilaManual(item: any, producto: any) {
    item.idProducto = producto.idProducto;
    item.nombre = producto.nombre;
    item.nombreConcepto = producto.nombre;
    item.precioCompra = Number(producto.precioUnitario) || 0;
    item.iva = Number(producto.iva) || 16;
    item.aplicaIva = producto.aplicaIva !== undefined ? producto.aplicaIva : this.aplicarIva();
    item.showSearch = false;
    this.recalcularFila(item);
    this.actualizarFila();
  }

  removerDelCarrito(tempId: number) {
    this.carrito.set(this.carrito().filter(i => i.tempId !== tempId));
    this.revisarEstadoGlobalIva();
  }

  aplicarTipoCambioGlobal() {
    const tc = this.tipoCambio();
    const nuevoCarrito = this.carrito().map(item => {
      item.tipoCambio = tc;
      this.recalcularFila(item);
      return item;
    });
    this.carrito.set(nuevoCarrito);
  }

  aplicarUtilidadGlobal() {
    const u = this.utilidadGlobal();
    const nuevoCarrito = this.carrito().map(item => {
      item.utilidadPorcentaje = u;
      this.recalcularFila(item);
      return item;
    });
    this.carrito.set(nuevoCarrito);
  }

  onGlobalIvaChange(val: boolean) {
    this.aplicarIva.set(val);
    const current = this.carrito();
    current.forEach(item => {
      item.aplicaIva = val;
    });
    this.carrito.set([...current]);
  }

  onRowIvaChange(item: any, val: boolean) {
    item.aplicaIva = val;
    this.revisarEstadoGlobalIva();
    this.actualizarFila();
  }

  revisarEstadoGlobalIva() {
    const current = this.carrito();
    if (current.length === 0) return;
    const todosTienenIva = current.every(c => c.aplicaIva);
    this.aplicarIva.set(todosTienenIva);
  }

  recalcularFila(item: any) {
    let basePriceMXN = Number(item.precioCompra);
    if (item.moneda === 'USD') {
      basePriceMXN = basePriceMXN * Number(item.tipoCambio || this.tipoCambio());
    }
    const factorUtilidad = 1 + (Number(item.utilidadPorcentaje) / 100);
    item.precioVenta = basePriceMXN * factorUtilidad;
    item.ganancia = item.precioVenta - basePriceMXN;
  }

  actualizarFila() {
    const current = this.carrito();
    current.forEach(item => this.recalcularFila(item));
    this.carrito.set([...current]);
  }

  costoBase = computed(() => {
    return this.carrito().reduce((acc, item) => {
      let base = Number(item.precioCompra);
      if (item.moneda === 'USD') base *= Number(item.tipoCambio || this.tipoCambio());
      return acc + (base * item.cantidad);
    }, 0);
  });

  utilidadGanancia = computed(() => {
    return this.carrito().reduce((acc, item) => acc + (Number(item.ganancia) * item.cantidad), 0);
  });

  subtotal = computed(() => {
    return this.carrito().reduce((acc, item) => acc + (item.cantidad * item.precioVenta), 0);
  });

  totalIva = computed(() => {
    const ivaDefecto = this.configService.config().ivaPorDefecto || 16;
    return this.carrito().reduce((acc, item) => {
      if (!item.aplicaIva) return acc;
      const sub = Number(item.cantidad) * Number(item.precioVenta);
      let iva = Number(item.iva);
      if (isNaN(iva) || iva === 0) iva = ivaDefecto;
      return acc + (sub * (iva > 0 ? (iva / 100) : 0));
    }, 0);
  });

  total = computed(() => this.subtotal() + this.totalIva());

  guardarCotizacion() {
    if (this.carrito().length === 0) {
      this.toast.show('Agrega al menos un producto', 'warning');
      return;
    }
    if (!this.idCliente()) {
      this.toast.show('Selecciona un cliente para continuar', 'warning');
      return;
    }

    this.guardando.set(true);

    const dateSelected = new Date(this.fechaCotizacion());
    const today = new Date();
    today.setHours(0,0,0,0);
    dateSelected.setHours(0,0,0,0);
    const diffTime = dateSelected.getTime() - today.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const payload = {
      idCliente: this.idCliente(),
      nombreClienteTemporal: null,
      vigenciaDias: diffDays,
      titulo: this.titulo() || null,
      observaciones: this.observaciones() || null,
      costoBase: this.costoBase(),
      utilidadTotal: this.utilidadGanancia(),
      tipoCambio: this.tipoCambio(),
      subtotal: this.subtotal(),
      descuento: 0,
      totalIva: this.totalIva(),
      total: this.total(),
      productos: this.carrito().map(c => ({
        idProducto: c.idProducto || null,
        nombreConcepto: c.nombreConcepto || null,
        cantidad: c.cantidad,
        precioUnitario: c.precioCompra,
        moneda: c.moneda,
        utilidadPorcentaje: c.utilidadPorcentaje,
        utilidadValor: c.ganancia,
        precioConUtilidad: c.precioVenta,
        aplicaIva: c.aplicaIva
      }))
    };

    this.posService.crearCotizacion(payload).subscribe({
      next: (res) => {
        this.toast.show('Cotización creada exitosamente', 'success');
        this.router.navigate(['/cotizaciones']);
      },
      error: (err) => {
        this.toast.show('Error al crear la cotización', 'error');
        this.guardando.set(false);
      }
    });
  }

  cancelar() {
    this.router.navigate(['/cotizaciones']);
  }
}
