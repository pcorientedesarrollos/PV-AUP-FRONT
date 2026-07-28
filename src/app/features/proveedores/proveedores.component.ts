import { environment } from '../../../environments/environment';
import { Component, signal, computed, effect, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ImportarModalComponent } from '../../shared/components/importar-modal/importar-modal.component';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, FormsModule, ImportarModalComponent],
  templateUrl: './proveedores.component.html',
})
export class ProveedoresComponent implements OnInit {
  apiUrl = environment.apiUrl;
  readonly API = environment.apiUrl + '/pos';
  toast = inject(ToastService);


  proveedores = signal<any[]>([]);
  compras = signal<any[]>([]);
  cargando = signal(true);
  cargandoCompras = signal(false);
  cargandoConstancia = signal(false);
  cargandoXml = signal(false);
  mostrarImportar = signal(false);
  
  // Archivos de factura en detalle
  subiendoFactura = signal(false);

  // XML Modals
  resolveProveedorXml: ((value: boolean) => void) | null = null;
  resolveProductosXml: ((value: boolean) => void) | null = null;
  mostrarModalNuevoProveedorXml = signal(false);
  proveedorXmlPendiente: any = null;
  mostrarModalNuevosProductosXml = signal(false);
  productosXmlPendientes: any[] = [];

  busqueda = signal('');
  proveedoresFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase();
    if (!q) return this.proveedores();
    return this.proveedores().filter(p =>
      p.nombre?.toLowerCase().includes(q) ||
      p.rfc?.toLowerCase().includes(q) ||
      p.contacto?.toLowerCase().includes(q)
    );
  });

  // --- PAGINACIÓN ---
  paginaActual = signal(1);
  tamanoPagina = signal(50);
  
  totalPaginas = computed(() => {
    return Math.max(1, Math.ceil(this.proveedoresFiltrados().length / this.tamanoPagina()));
  });

  proveedoresPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    const fin = inicio + this.tamanoPagina();
    return this.proveedoresFiltrados().slice(inicio, fin);
  });

  // Modal Proveedor
  mostrarModalProveedor = signal(false);
  modoProveedor = signal<'crear' | 'editar'>('crear');

  regimenes = [
    { id: '601', nombre: 'General de Ley Personas Morales' },
    { id: '603', nombre: 'Personas Morales con Fines no Lucrativos' },
    { id: '605', nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
    { id: '606', nombre: 'Arrendamiento' },
    { id: '607', nombre: 'Régimen de Enajenación o Adquisición de Bienes' },
    { id: '612', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales' },
    { id: '616', nombre: 'Sin obligaciones fiscales' },
    { id: '626', nombre: 'Régimen Simplificado de Confianza' }
  ];

  usos = [
    { id: 'G01', nombre: 'Adquisición de mercancias' },
    { id: 'G03', nombre: 'Gastos en general' },
    { id: 'I04', nombre: 'Equipo de computo y accesorios' },
    { id: 'S01', nombre: 'Sin efectos fiscales' },
    { id: 'CP01', nombre: 'Pagos' }
  ];

  formasPago = [
    { id: '01', nombre: 'Efectivo' },
    { id: '02', nombre: 'Cheque nominativo' },
    { id: '03', nombre: 'Transferencia electrónica de fondos' },
    { id: '04', nombre: 'Tarjeta de crédito' },
    { id: '28', nombre: 'Tarjeta de débito' },
    { id: '99', nombre: 'Por definir' }
  ];

  metodosPago = [
    { id: 'PUE', nombre: 'Pago en una sola exhibición' },
    { id: 'PPD', nombre: 'Pago en parcialidades o diferido' }
  ];


  coincidenciasNombre(): any[] {
    if (!this.proveedorActual?.nombre || this.proveedorActual.nombre.trim().length < 2) return [];
    const term = this.proveedorActual.nombre.toLowerCase().trim();
    return this.proveedores().filter((p: any) => p.nombre?.toLowerCase().includes(term) && p.idProveedor !== this.proveedorActual.idProveedor).slice(0, 5);
  }

  coincidenciasRfc(): any[] {
    if (!this.proveedorActual?.rfc || this.proveedorActual.rfc.trim().length < 2) return [];
    const term = this.proveedorActual.rfc.toLowerCase().trim();
    return this.proveedores().filter((p: any) => p.rfc?.toLowerCase().includes(term) && p.idProveedor !== this.proveedorActual.idProveedor).slice(0, 5);
  }

  get duplicadoNombre(): boolean {
    if (!this.proveedorActual?.nombre) return false;
    const nombre = this.proveedorActual.nombre.toLowerCase().trim();
    return this.proveedores().some((p: any) => p.nombre?.toLowerCase().trim() === nombre && p.idProveedor !== this.proveedorActual.idProveedor);
  }
  
  get duplicadoRfc(): boolean {
    if (!this.proveedorActual?.rfc) return false;
    const rfc = this.proveedorActual.rfc.toLowerCase().trim();
    return this.proveedores().some((p: any) => p.rfc?.toLowerCase().trim() === rfc && p.idProveedor !== this.proveedorActual.idProveedor);
  }

  proveedorActual: any = {};

  getNombreFormaPago(codigo: string): string {
    const formas: Record<string, string> = {
      '01': '01 - Efectivo',
      '02': '02 - Cheque nominativo',
      '03': '03 - Transferencia electrónica de fondos',
      '04': '04 - Tarjeta de crédito',
      '28': '28 - Tarjeta de débito',
      '99': '99 - Por definir'
    };
    return formas[codigo] || codigo;
  }

  getNombreUsoCfdi(codigo: string): string {
    const usos: Record<string, string> = {
      'G01': 'G01 - Adquisición de mercancías',
      'G03': 'G03 - Gastos en general',
      'S01': 'S01 - Sin efectos fiscales',
      'P01': 'P01 - Por definir'
    };
    return usos[codigo] || codigo;
  }

  // Panel Compras
  mostrarPanelCompras = signal(false);
  proveedorSeleccionado = signal<any>(null);

  // Modal Nueva Compra
  mostrarModalCompra = signal(false);
  compraActual: any = {};
  detallesCompra: any[] = [];
  productosDisponibles = signal<any[]>([]);
  busquedaProducto = '';
  productosFiltrados = computed(() => {
    const q = this.busquedaProducto.toLowerCase();
    if (!q) return this.productosDisponibles();
    return this.productosDisponibles().filter(p => p.nombre?.toLowerCase().includes(q) || p.codigoBarras?.includes(q));
  });

  // Archivos de factura
  archivoPdf: File | null = null;
  archivoXml: File | null = null;
  guardandoCompra = signal(false);

  // Modal Detalle Compra
  mostrarDetalle = signal(false);
  compraDetalle = signal<any>(null);

  get headers() {
    const s = this.auth.sesion();
    const h: any = {};
    if (s?.idSucursal) h['x-sucursal-id'] = String(s.idSucursal);
    if (s?.idUsuario) h['x-usuario-id'] = String(s.idUsuario);
    return h;
  }

  constructor(private http: HttpClient, private auth: AuthService) {
    effect(() => {
      this.busqueda();
      this.paginaActual.set(1);
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.cargarProveedores();
    this.cargarProductos();
  }

  cargarProveedores() {
    this.cargando.set(true);
    this.http.get<any[]>(`${this.API}/proveedores`, { headers: this.headers }).subscribe({
      next: (data) => { this.proveedores.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }

  cargarProductos() {
    this.http.get<any[]>(`${this.API}/productos`, { headers: this.headers }).subscribe({
      next: (data) => this.productosDisponibles.set(data),
      error: () => {}
    });
  }

  cargarComprasDeProveedor(proveedor: any) {
    this.proveedorSeleccionado.set(proveedor);
    this.mostrarPanelCompras.set(true);
    this.cargandoCompras.set(true);
    this.http.get<any[]>(`${this.API}/compras?idProveedor=${proveedor.idProveedor}`, { headers: this.headers }).subscribe({
      next: (data) => {
        this.compras.set(data);
        this.cargandoCompras.set(false);
      },
      error: () => this.cargandoCompras.set(false)
    });
  }

  // 🛒 CRUD PROVEEDOR 🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒🛒
  onConstanciaSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.cargandoConstancia.set(true);
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>(`${this.API}/utils/parse-csf`, fd, { headers: this.headers }).subscribe({
      next: (data) => {
        if (data.rfc) this.proveedorActual.rfc = data.rfc;
        if (data.nombre) this.proveedorActual.nombre = data.nombre;
        if (data.direccion) this.proveedorActual.direccion = data.direccion;
        
        if (data.cp) {
          this.proveedorActual.cp = data.cp;
        }
        if (data.regimenFiscal) {
          this.proveedorActual.regimenFiscal = data.regimenFiscal;
          if (data.regimenFiscal === '616') {
            this.proveedorActual.usoCfdi = 'S01';
          } else {
            this.proveedorActual.usoCfdi = 'G03';
          }
        }
        this.proveedorActual.formaPago = '01';
        this.proveedorActual.metodoPago = 'PUE';

        this.cargandoConstancia.set(false);
      },
      error: () => {
        this.cargandoConstancia.set(false);
        this.toast.show('Error al leer la constancia. Por favor ingresa los datos manualmente.', 'error');
      }
    });
  }

  abrirModalCrear() {
    this.modoProveedor.set('crear');
    this.proveedorActual = { 
      nombre: '', contacto: '', telefono: '', correo: '', rfc: '', direccion: '', 
      cp: '', regimenFiscal: '601', usoCfdi: 'G03', formaPago: '01', metodoPago: 'PUE' 
    };
    this.mostrarModalProveedor.set(true);
  }

  abrirModalEditar(p: any) {
    this.modoProveedor.set('editar');
    this.proveedorActual = { 
      ...p,
      cp: p.cp || '',
      regimenFiscal: p.regimenFiscal || '601',
      usoCfdi: p.usoCfdi || 'G03',
      formaPago: p.formaPago || '01',
      metodoPago: p.metodoPago || 'PUE'
    };
    this.mostrarModalProveedor.set(true);
  }

  guardarProveedor() {
    if (!this.proveedorActual.nombre?.trim()) { 
      this.toast.show('El nombre es obligatorio', 'warning'); 
      return; 
    }
    
    // Validar duplicados en local
    const rfc = this.proveedorActual.rfc?.trim().toLowerCase();
    const nombre = this.proveedorActual.nombre?.trim().toLowerCase();
    const duplicado = this.proveedores().find(p => 
      p.idProveedor !== this.proveedorActual.idProveedor && 
      ((rfc && p.rfc?.trim().toLowerCase() === rfc) || 
       (nombre && p.nombre?.trim().toLowerCase() === nombre))
    );
    if (duplicado) {
      this.toast.show(`Ya existe un proveedor con este Nombre o RFC (${duplicado.nombre}).`, 'error');
      return;
    }

    const obs = this.modoProveedor() === 'crear'
      ? this.http.post(`${this.API}/proveedores`, this.proveedorActual, { headers: this.headers })
      : this.http.put(`${this.API}/proveedores/${this.proveedorActual.idProveedor}`, this.proveedorActual, { headers: this.headers });
      
    obs.subscribe({ 
      next: () => { 
        this.toast.show(`Proveedor guardado exitosamente.`, 'success');
        this.mostrarModalProveedor.set(false); 
        this.cargarProveedores(); 
      }, 
      error: (err: HttpErrorResponse) => {
        if (err.error?.message) {
          this.toast.show(err.error.message, 'error');
        } else {
          this.toast.show('Error al guardar. Verifica que los datos no estén duplicados.', 'error');
        }
      } 
    });
  }

  eliminarProveedor(p: any) {
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return;
    this.http.delete(`${this.API}/proveedores/${p.idProveedor}`, { headers: this.headers }).subscribe({
      next: () => this.cargarProveedores(),
      error: () => alert('Error al eliminar')
    });
  }

  // ─── COMPRAS ─────────────────────────────────────────────────
  abrirModalCompra() {
    this.compraActual = {
      idProveedor: this.proveedorSeleccionado()?.idProveedor || null,
      folioFacturaProveedor: '',
      notas: ''
    };
    this.detallesCompra = [];
    this.archivoPdf = null;
    this.archivoXml = null;
    this.mostrarModalCompra.set(true);
  }

  agregarProducto(prod: any) {
    const existe = this.detallesCompra.find(d => d.idProducto === prod.idProducto);
    if (existe) { existe.cantidad++; } else {
      this.detallesCompra.push({ idProducto: prod.idProducto, nombre: prod.nombre, cantidad: 1, precioCosto: 0, subtotal: 0 });
    }
    this.recalcularTotal();
    this.busquedaProducto = '';
  }

  quitarProducto(idx: number) { this.detallesCompra.splice(idx, 1); this.recalcularTotal(); }

  recalcularTotal() {
    this.detallesCompra.forEach(d => d.subtotal = d.cantidad * d.precioCosto);
    this.compraActual.total = this.detallesCompra.reduce((s, d) => s + d.subtotal, 0);
  }

  onArchivoPdf(event: any) { this.archivoPdf = event.target.files[0] || null; }
  
  async onArchivoXml(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.archivoXml = file;
    this.cargandoXml.set(true);
    const fd = new FormData();
    fd.append('xml', file);
    
    try {
      const data = await this.http.post<any>(`${this.API}/inventario/importar-xml`, fd, { headers: this.headers }).toPromise();
      
      if (data.folio) this.compraActual.folioFacturaProveedor = data.folio;

      // 1. Validar y agregar Proveedor
      if (data.emisor && data.emisor.rfc) {
        const rfc = data.emisor.rfc.toUpperCase();
        let prov = this.proveedores().find(p => p.rfc?.toUpperCase() === rfc);
        
        if (!prov) {
          this.proveedorXmlPendiente = data.emisor;
          this.mostrarModalNuevoProveedorXml.set(true);
          const userApproved = await new Promise<boolean>(resolve => this.resolveProveedorXml = resolve);
          this.mostrarModalNuevoProveedorXml.set(false);
          this.proveedorXmlPendiente = null;
          
          if (userApproved) {
            const nuevoProv = { nombre: data.emisor.nombre, rfc: data.emisor.rfc, contacto: '', telefono: '', correo: '', direccion: '' };
            await this.http.post(`${this.API}/proveedores`, nuevoProv, { headers: this.headers }).toPromise();
            await this.cargarProveedoresPromise();
            prov = this.proveedores().find(p => p.rfc?.toUpperCase() === rfc);
            this.toast.show('Proveedor agregado exitosamente.', 'success');
          }
        }
        
        if (prov) {
          this.proveedorSeleccionado.set(prov);
          this.compraActual.idProveedor = prov.idProveedor;
        }
      }

      // 2. Validar y agregar Productos Nuevos
      if (data.conceptos && data.conceptos.length) {
        const nuevosConceptos: any[] = [];
        const conceptosProcesados: any[] = [];

        data.conceptos.forEach((c: any) => {
          let idProducto = null;
          // Buscar producto en memoria por si no se encontró en backend
          const prod = this.productosDisponibles().find(p => 
            (c.noIdentificacion && p.codigoBarras === c.noIdentificacion) ||
            (p.nombre?.toLowerCase() === c.conceptoXml?.toLowerCase())
          );
          
          if (c.productoEncontrado) {
             idProducto = c.productoEncontrado.idProducto;
          } else if (prod) {
             idProducto = prod.idProducto;
          }
          
          if (idProducto) {
            conceptosProcesados.push({
              idProducto: idProducto,
              nombre: c.conceptoXml,
              cantidad: c.cantidad,
              precioCosto: c.costoUnitario,
              subtotal: c.cantidad * c.costoUnitario
            });
          } else {
            nuevosConceptos.push(c);
          }
        });

        if (nuevosConceptos.length > 0) {
          this.productosXmlPendientes = nuevosConceptos;
          this.mostrarModalNuevosProductosXml.set(true);
          const userApproved = await new Promise<boolean>(resolve => this.resolveProductosXml = resolve);
          this.mostrarModalNuevosProductosXml.set(false);
          this.productosXmlPendientes = [];
          
          if (userApproved) {
            for (const nc of nuevosConceptos) {
              try {
                const payloadProd = {
                  nombre: nc.conceptoXml,
                  codigoBarras: nc.noIdentificacion || '',
                  precioUnitario: 0,
                };
                const resProd: any = await this.http.post(`${this.API}/productos`, payloadProd, { headers: this.headers }).toPromise();
                
                conceptosProcesados.push({
                  idProducto: resProd.idProducto || resProd.producto?.idProducto,
                  nombre: nc.conceptoXml,
                  cantidad: nc.cantidad,
                  precioCosto: nc.costoUnitario,
                  subtotal: nc.cantidad * nc.costoUnitario
                });
              } catch(e) {
                this.toast.show(`Error al crear el producto ${nc.conceptoXml}`, 'error');
              }
            }
            await this.cargarProductosPromise();
            this.toast.show('Productos nuevos agregados al catálogo.', 'success');
          } else {
            // Agregar sin ID (requerirá mapeo manual)
            nuevosConceptos.forEach(nc => {
               conceptosProcesados.push({
                  idProducto: null,
                  nombre: nc.conceptoXml,
                  cantidad: nc.cantidad,
                  precioCosto: nc.costoUnitario,
                  subtotal: nc.cantidad * nc.costoUnitario
                });
            });
          }
        }

        this.detallesCompra.push(...conceptosProcesados);
        this.recalcularTotal();
      }

      this.cargandoXml.set(false);
    } catch (error) {
      this.cargandoXml.set(false);
      this.toast.show('Error al procesar el XML de la factura.', 'error');
    }
  }

  cargarProveedoresPromise() {
    return new Promise<void>((resolve) => {
      this.http.get<any[]>(`${this.API}/proveedores`, { headers: this.headers }).subscribe({
        next: (data) => { this.proveedores.set(data); resolve(); },
        error: () => resolve()
      });
    });
  }

  cargarProductosPromise() {
    return new Promise<void>((resolve) => {
      this.http.get<any[]>(`${this.API}/productos`, { headers: this.headers }).subscribe({
        next: (data) => { this.productosDisponibles.set(data); resolve(); },
        error: () => resolve()
      });
    });
  }

  async guardarCompra() {
    if (!this.detallesCompra.length) { alert('Agrega al menos un producto'); return; }
    // Validar cantidad y costo validos
    if (this.detallesCompra.some(d => !d.cantidad || d.cantidad <= 0 || (d as any).precioCosto < 0)) {
      alert('Verifica que todas las cantidades y costos sean válidos');
      return;
    }
    this.guardandoCompra.set(true);
    const payload = { ...this.compraActual, detalles: this.detallesCompra };
    this.http.post<any>(`${this.API}/compras`, payload, { headers: this.headers }).subscribe({
      next: async (res) => {
        if (this.archivoPdf || this.archivoXml) {
          const fd = new FormData();
          if (this.archivoPdf) fd.append('pdf', this.archivoPdf);
          if (this.archivoXml) fd.append('xml', this.archivoXml);
          await this.http.patch(`${this.API}/compras/${res.compra.idCompra}/factura`, fd, { headers: this.headers }).toPromise();
        }
        this.guardandoCompra.set(false);
        this.mostrarModalCompra.set(false);
        this.cargarComprasDeProveedor(this.proveedorSeleccionado());
      },
      error: () => { this.guardandoCompra.set(false); alert('Error al registrar la compra'); }
    });
  }

  verDetalleCompra(compra: any) {
    this.http.get<any>(`${this.API}/compras/${compra.idCompra}`, { headers: this.headers }).subscribe({
      next: (data) => { this.compraDetalle.set(data); this.mostrarDetalle.set(true); },
      error: () => alert('Error al cargar el detalle')
    });
  }

  totalCompras() { return this.compras().reduce((s, c) => s + Number(c.total), 0); }

  descargarXml(url: string) {
    if (url) {
      const encodedUrl = encodeURIComponent(url);
      window.open(`${environment.apiUrl}/pos/proxy/descargar-xml?url=${encodedUrl}`, '_self');
    }
  }

  verPdf(url: string) {
    if (url) {
      window.open(`${environment.apiUrl}${url}`, '_blank');
    }
  }

  adjuntarFacturaExistente(event: any, tipo: 'pdf' | 'xml') {
    const file = event.target.files[0];
    if (!file) return;

    const compra = this.compraDetalle();
    if (!compra || !compra.idCompra) return;

    this.subiendoFactura.set(true);
    const fd = new FormData();
    fd.append(tipo, file);

    this.http.patch<any>(`${this.API}/compras/${compra.idCompra}/factura`, fd, { headers: this.headers }).subscribe({
      next: (res) => {
        // Actualizar la vista del detalle
        const updated = { ...this.compraDetalle() };
        if (tipo === 'pdf') updated.urlFacturaPdf = res.urlFacturaPdf;
        if (tipo === 'xml') updated.urlFacturaXml = res.urlFacturaXml;
        this.compraDetalle.set(updated);
        
        // Refrescar lista de compras
        this.cargarComprasDeProveedor(this.proveedorSeleccionado());
        this.subiendoFactura.set(false);
        // Reset input
        event.target.value = '';
      },
      error: () => {
        this.subiendoFactura.set(false);
        alert(`Error al adjuntar el archivo ${tipo.toUpperCase()}`);
        event.target.value = '';
      }
    });
  }
}
