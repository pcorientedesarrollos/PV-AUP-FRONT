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
  aplicarIva = signal<boolean>(true);
  
  tipoCambio = signal<number>(18.50); // Default, updated on load
  utilidadGlobal = signal<number>(0);

  // Carrito
  carrito = signal<any[]>([]);
  busquedaProducto = signal<string>('');
  conceptosFacturados = signal<any[]>([]);
  buscandoConceptos = signal<boolean>(false);
  searchTimeout: any;
  
  guardando = signal(false);

  ngOnInit() {
    this.cargarClientes();
    this.cargarTipoCambio();
  }

  cargarClientes() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/clientes`).subscribe(data => this.clientes.set(data));
  }
  
  cargarTipoCambio() {
    this.http.get<any>(`${environment.apiUrl}/pos/tipo-cambio`).subscribe({
      next: (data) => {
        if (data && data.mxn) {
          this.tipoCambio.set(data.mxn);
          this.actualizarFila();
          this.toast.show('Tipo de cambio actualizado (' + data.mxn.toFixed(2) + ')', 'success');
        }
      },
      error: (err) => {
        console.error('Error fetching exchange rate', err);
        this.toast.show('Error al obtener el tipo de cambio', 'error');
      }
    });
  }

  clientesFiltrados = computed(() => {
    const term = this.clienteBuscado().toLowerCase().trim();
    if (!term) return this.clientes();
    return this.clientes().filter(c => 
      (c.nombreCompleto || '').toLowerCase().includes(term) || 
      (c.rfc || '').toLowerCase().includes(term)
    );
  });

  seleccionarClienteDropdown(cliente: any) {
    this.idCliente.set(cliente.idCliente);
    this.clienteBuscado.set(cliente.nombreCompleto);
    this.mostrarDropdownClientes.set(false);
  }
  
  onClienteInput() {
    this.idCliente.set(null);
  }

  buscarConceptosApi() {
    const term = this.busquedaProducto().trim();
    if (term.length < 2) {
      this.conceptosFacturados.set([]);
      return;
    }
    
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    
    this.searchTimeout = setTimeout(() => {
      this.buscandoConceptos.set(true);
      this.http.get<any[]>(`${environment.apiUrl}/pos/compras/conceptos?q=${encodeURIComponent(term)}`)
        .subscribe({
          next: (data) => {
            this.conceptosFacturados.set(data);
            this.buscandoConceptos.set(false);
          },
          error: (err) => {
            console.error(err);
            this.conceptosFacturados.set([]);
            this.buscandoConceptos.set(false);
          }
        });
    }, 500);
  }

  agregarAlCarrito(producto: any) {
    const current = this.carrito();
    const existe = current.find(item => item.idProducto === producto.idProducto);
    
    if (existe) {
      existe.cantidad++;
      this.recalcularFila(existe);
      this.carrito.set([...current]);
    } else {
      const pUnit = Number(producto.precioUnitario) || 0;
      const fila = {
        tempId: Date.now() + Math.random(),
        idProducto: producto.idProducto,
        nombre: producto.nombre,
        proveedor: producto.proveedor,
        folioCompra: producto.folio,
        fechaCompra: producto.fechaCompra,
        cantidad: 1,
        precioUnitario: pUnit,
        iva: Number(producto.iva) || 0,
        moneda: 'MXN', // Or based on product if they have currency
        tipoCambio: this.tipoCambio(),
        utilidadPorcentaje: this.utilidadGlobal(),
        utilidadValor: 0,
        precioConUtilidad: pUnit
      };
      this.recalcularFila(fila);
      this.carrito.set([...current, fila]);
    }
    this.busquedaProducto.set('');
    this.conceptosFacturados.set([]);
  }

  onClienteCreado(cliente: any) {
    this.mostrarNuevoCliente.set(false);
    this.clientes.set([...this.clientes(), cliente]);
    this.idCliente.set(cliente.idCliente);
    this.toast.show('Cliente creado y seleccionado', 'success');
  }

  agregarConceptoManual() {
    const current = this.carrito();
    const fila = {
      tempId: Date.now() + Math.random(),
      nombreConcepto: 'Concepto manual',
      cantidad: 1,
      precioUnitario: 0,
      iva: this.configService.config().ivaPorDefecto || 16,
      moneda: 'MXN',
      tipoCambio: this.tipoCambio(),
      utilidadPorcentaje: this.utilidadGlobal(),
      utilidadValor: 0,
      precioConUtilidad: 0
    };
    this.recalcularFila(fila);
    this.carrito.set([...current, fila]);
  }

  removerDelCarrito(tempId: number) {
    this.carrito.set(this.carrito().filter(i => i.tempId !== tempId));
  }

  
  aplicarTipoCambioGlobal() {
    const tc = this.tipoCambio();
    const nuevoCarrito = this.carrito().map(item => {
      item.tipoCambio = tc;
      this.recalcularFila(item);
      return item;
    });
    this.carrito.set(nuevoCarrito);
    this.toast.show('Tipo de cambio aplicado a todos los conceptos', 'success');
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

  recalcularFila(item: any) {
    // precioUnitario is treated as cost.
    let basePriceMXN = Number(item.precioUnitario);
    if (item.moneda === 'USD') {
      basePriceMXN = basePriceMXN * this.tipoCambio();
    }
    const factorUtilidad = 1 + (Number(item.utilidadPorcentaje) / 100);
    item.precioConUtilidad = basePriceMXN * factorUtilidad;
    item.utilidadValor = item.precioConUtilidad - basePriceMXN;
  }

  actualizarFila() {
    // When a row field changes via ngModel
    const current = this.carrito();
    current.forEach(item => this.recalcularFila(item));
    this.carrito.set([...current]);
  }

  costoBase = computed(() => {
    return this.carrito().reduce((acc, item) => {
      let base = Number(item.precioUnitario);
      if (item.moneda === 'USD') base *= this.tipoCambio();
      return acc + (base * item.cantidad);
    }, 0);
  });

  utilidadGanancia = computed(() => {
    return this.carrito().reduce((acc, item) => acc + (Number(item.utilidadValor) * item.cantidad), 0);
  });

  subtotal = computed(() => {
    return this.carrito().reduce((acc, item) => acc + (item.cantidad * item.precioConUtilidad), 0);
  });

  totalIva = computed(() => {
    if (!this.aplicarIva()) return 0;
    const ivaDefecto = this.configService.config().ivaPorDefecto || 16;
    return this.carrito().reduce((acc, item) => {
      const sub = Number(item.cantidad) * Number(item.precioConUtilidad);
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
        precioUnitario: c.precioUnitario,
        moneda: c.moneda,
        utilidadPorcentaje: c.utilidadPorcentaje,
        utilidadValor: c.utilidadValor,
        precioConUtilidad: c.precioConUtilidad
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
