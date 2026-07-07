import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proveedores.component.html',
})
export class ProveedoresComponent implements OnInit {
  readonly API = 'http://localhost:3000/pos';

  proveedores = signal<any[]>([]);
  compras = signal<any[]>([]);
  cargando = signal(true);
  cargandoCompras = signal(false);

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

  // Modal Proveedor
  mostrarModalProveedor = signal(false);
  modoProveedor = signal<'crear' | 'editar'>('crear');
  proveedorActual: any = {};

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

  constructor(private http: HttpClient, private auth: AuthService) {}

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

  // ─── CRUD PROVEEDOR ───────────────────────────────────────────
  abrirModalCrear() {
    this.modoProveedor.set('crear');
    this.proveedorActual = { nombre: '', contacto: '', telefono: '', correo: '', rfc: '', direccion: '' };
    this.mostrarModalProveedor.set(true);
  }

  abrirModalEditar(p: any) {
    this.modoProveedor.set('editar');
    this.proveedorActual = { ...p };
    this.mostrarModalProveedor.set(true);
  }

  guardarProveedor() {
    if (!this.proveedorActual.nombre?.trim()) { alert('El nombre es obligatorio'); return; }
    const obs = this.modoProveedor() === 'crear'
      ? this.http.post(`${this.API}/proveedores`, this.proveedorActual, { headers: this.headers })
      : this.http.put(`${this.API}/proveedores/${this.proveedorActual.idProveedor}`, this.proveedorActual, { headers: this.headers });
    obs.subscribe({ next: () => { this.mostrarModalProveedor.set(false); this.cargarProveedores(); }, error: () => alert('Error al guardar') });
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
  onArchivoXml(event: any) { this.archivoXml = event.target.files[0] || null; }

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
}
