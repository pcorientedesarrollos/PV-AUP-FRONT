import { environment } from '../../../environments/environment';
import { Component, signal, computed, effect, OnInit, inject } from '@angular/core';
import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ImportarModalComponent } from '../../shared/components/importar-modal/importar-modal.component';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, FormsModule, ImportarModalComponent, PaginacionComponent],
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
  tamanoPagina = signal(10);
  
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
  productosDisponibles = signal<any[]>([]);

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

  constructor(private http: HttpClient, private auth: AuthService, private router: Router) {
    effect(() => {
      this.busqueda();
      this.paginaActual.set(1);
    });
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

  irANuevaCompra() {
    const provId = this.proveedorSeleccionado()?.idProveedor;
    if (provId) {
      this.router.navigate(['/compras/nueva'], { queryParams: { proveedorId: provId } });
    } else {
      this.router.navigate(['/compras/nueva']);
    }
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


