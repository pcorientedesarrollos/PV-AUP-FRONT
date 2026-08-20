import { Component, signal, computed, effect, OnInit } from '@angular/core';
import { ExportService } from '../../core/services/export.service';
import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { BarcodeDirective } from '../../shared/directives/barcode.directive';
import JsBarcode from 'jsbarcode';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { ImportarModalComponent } from '../../shared/components/importar-modal/importar-modal.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeDirective, ImportarModalComponent, PaginacionComponent, SearchableSelectComponent],
  templateUrl: './productos.component.html',
})
export class ProductosComponent implements OnInit {
  apiUrl = environment.apiUrl;
  
  productos = signal<any[]>([]);
  cargando = signal(false);
  mostrarImportar = signal(false);

  // Panel proveedores por producto
  productoSeleccionado = signal<any | null>(null);
  comprasProducto = signal<any[]>([]);
  cargandoComprasProducto = signal(false);

  // Modal: detalle de compra (estilo factura)
  compraDetalle = signal<any | null>(null);
  cargandoCompraDetalle = signal(false);

  busqueda = signal('');
  filtroFamilia = signal<number | 'todas'>('todas');
  filtroStock = signal<'todos' | 'sin-stock' | 'stock-bajo' | 'disponible'>('todos');
  vistaGrid = signal(false); // toggle tabla/tarjetas

  filtroEmpresa = signal<number | 'todas'>('todas');
  filtroSucursal = signal<number | 'todas'>('todas');

  isSoporte = computed(() => this.auth.sesion()?.idPerfil === 3);

  empresas = signal<any[]>([]);
  sucursales = signal<any[]>([]);
  
  sucursalesFiltradas = computed(() => {
    const fEmpresa = this.filtroEmpresa();
    if (fEmpresa === 'todas') return this.sucursales();
    return this.sucursales().filter(s => s.empresa?.idEmpresa === fEmpresa);
  });
  
  categoriasFiltradas = computed(() => {
    const fEmpresa = this.filtroEmpresa();
    if (fEmpresa === 'todas') return this.categorias();
    return this.categorias().filter(c => c.empresa?.idEmpresa === fEmpresa);
  });

  productosFiltrados = computed(() => {
    const query = this.busqueda().toLowerCase();
    const familia = this.filtroFamilia();
    const stock = this.filtroStock();
    const fEmpresa = this.filtroEmpresa();
    const fSucursal = this.filtroSucursal();

    return this.productos().filter(p => {
      const coincideTexto =
        p.nombre.toLowerCase().includes(query) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(query)) ||
        p.idProducto.toString().includes(query);

      let coincideFamilia = true;
      if (familia !== 'todas') {
        const id = p.categoria?.idCategoria || p.idCategoria;
        coincideFamilia = (id === familia);
      }

      let coincideStock = true;
      const st = Number(p.stockActual);
      const min = p.stockMinimo != null && p.stockMinimo !== '' ? Number(p.stockMinimo) : 5;
      if (stock === 'sin-stock') coincideStock = st <= 0;
      else if (stock === 'stock-bajo') coincideStock = st > 0 && st <= min;
      else if (stock === 'disponible') coincideStock = st > min;

      let coincideEmpresa = true;
      if (fEmpresa !== 'todas') {
        coincideEmpresa = p.sucursal?.empresa?.idEmpresa === fEmpresa;
      }

      let coincideSucursal = true;
      if (fSucursal !== 'todas') {
        coincideSucursal = p.sucursal?.idSucursal === fSucursal;
      }

      return coincideTexto && coincideFamilia && coincideStock && coincideEmpresa && coincideSucursal;
    });
  });

  // --- PAGINACIÓN ---
  paginaActual = signal(1);
  tamanoPagina = signal(10);
  
  totalPaginas = computed(() => {
    return Math.max(1, Math.ceil(this.productosFiltrados().length / this.tamanoPagina()));
  });

  productosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    const fin = inicio + this.tamanoPagina();
    return this.productosFiltrados().slice(inicio, fin);
  });

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    public auth: AuthService
  , public exportService: ExportService) {
    // Resetear a página 1 cuando cambia algún filtro
    effect(() => {
      this.busqueda();
      this.filtroFamilia();
      this.filtroStock();
      this.filtroEmpresa();
      this.filtroSucursal();
      this.paginaActual.set(1);
    });
  }

  // Estadísticas (siempre sobre todos los productos, no el filtro)
  totalProductos = computed(() => this.productos().length);
  sinStock = computed(() => this.productos().filter(p => Number(p.stockActual) <= 0).length);
  stockBajo = computed(() => this.productos().filter(p => {
    const s = Number(p.stockActual);
    const min = p.stockMinimo != null && p.stockMinimo !== '' ? Number(p.stockMinimo) : 5;
    return s > 0 && s <= min;
  }).length);
  disponible = computed(() => this.productos().filter(p => {
    const s = Number(p.stockActual);
    const min = p.stockMinimo != null && p.stockMinimo !== '' ? Number(p.stockMinimo) : 5;
    return s > min;
  }).length);

  ciclarFiltroStock() {
    const orden: Array<'todos' | 'sin-stock' | 'stock-bajo' | 'disponible'> = ['todos', 'sin-stock', 'stock-bajo', 'disponible'];
    const actual = this.filtroStock();
    const idx = orden.indexOf(actual);
    this.filtroStock.set(orden[(idx + 1) % orden.length]);
  }

  getLabelFiltroStock(): string {
    const labels: Record<string, string> = {
      'todos': 'Stock ↕',
      'sin-stock': 'Sin Stock 🔴',
      'stock-bajo': 'Stock Bajo 🟡',
      'disponible': 'Disponible 🟢'
    };
    return labels[this.filtroStock()] || 'Stock';
  }

  // Modal editar / crear
  mostrarModal = signal(false);
  esNuevoProducto = signal(false);
  guardando = signal(false);
  nuevoProducto: any = {};
  archivoImagen: File | null = null;
  imagenPreview = signal<string | null>(null);
  categorias = signal<any[]>([]);

  // Recetas / Ingredientes
  mostrarModalReceta = signal(false);
  cargandoReceta = signal(false);
  productoReceta = signal<any | null>(null);
  ingredientes = signal<any[]>([]);
  nuevoIngrediente = signal({ idProductoHijo: null, cantidad: 1 });
  productosParaReceta = computed(() => {
    const curr = this.productoReceta();
    if (!curr) return [];
    return this.productos().filter(p => p.idProducto !== curr.idProducto);
  });

  // Validaciones en tiempo real
  
  coincidenciasNombre(): any[] {
    if (!this.nuevoProducto?.nombre || this.nuevoProducto.nombre.trim().length < 2) return [];
    const term = this.nuevoProducto.nombre.toLowerCase().trim();
    return this.productos().filter(p => p.nombre.toLowerCase().includes(term) && p.idProducto !== this.nuevoProducto.idProducto).slice(0, 5);
  }

  coincidenciasCodigo(): any[] {
    if (!this.nuevoProducto?.codigoBarras || this.nuevoProducto.codigoBarras.trim().length < 2) return [];
    const term = this.nuevoProducto.codigoBarras.toLowerCase().trim();
    return this.productos().filter(p => p.codigoBarras?.toLowerCase().includes(term) && p.idProducto !== this.nuevoProducto.idProducto).slice(0, 5);
  }

  duplicadoNombre(): boolean {
    if (!this.nuevoProducto?.nombre) return false;
    const nombre = this.nuevoProducto.nombre.toLowerCase().trim();
    return this.productos().some(p => p.nombre.toLowerCase().trim() === nombre && p.idProducto !== this.nuevoProducto.idProducto);
  }
  
  duplicadoCodigo(): boolean {
    if (!this.nuevoProducto?.codigoBarras) return false;
    const codigo = this.nuevoProducto.codigoBarras.toLowerCase().trim();
    return this.productos().some(p => p.codigoBarras?.toLowerCase().trim() === codigo && p.idProducto !== this.nuevoProducto.idProducto);
  }

  formularioInvalido(): boolean {
    return !this.nuevoProducto?.nombre?.trim() || this.duplicadoNombre() || this.duplicadoCodigo();
  }


  // Modal código de barras
  codigoBarrasVisualizar = signal<string | null>(null);

  verComprasProducto(prod: any) {
    if (this.productoSeleccionado()?.idProducto === prod.idProducto) {
      this.productoSeleccionado.set(null);
      this.comprasProducto.set([]);
      return;
    }
    this.productoSeleccionado.set(prod);
    this.cargandoComprasProducto.set(true);
    this.comprasProducto.set([]);
    this.http.get<any[]>(`${environment.apiUrl}/pos/productos/${prod.idProducto}/compras`).subscribe({
      next: (data) => { this.comprasProducto.set(data); this.cargandoComprasProducto.set(false); },
      error: () => this.cargandoComprasProducto.set(false)
    });
  }

  cerrarComprasProducto() {
    this.productoSeleccionado.set(null);
    this.comprasProducto.set([]);
  }

  verDetalleCompra(compra: any) {
    this.cargandoCompraDetalle.set(true);
    this.compraDetalle.set(null);
    this.http.get<any>(`${environment.apiUrl}/pos/compras/${compra.idCompra}`).subscribe({
      next: (data) => {
        this.compraDetalle.set(data);
        this.cargandoCompraDetalle.set(false);
      },
      error: () => this.cargandoCompraDetalle.set(false)
    });
  }

  cerrarDetalleCompra() {
    this.compraDetalle.set(null);
  }

  // SAT Catalog
  satProductQuery: string = '';
  satUnitQuery: string = '';
  satProductsResults: any[] = [];
  satUnitsResults: any[] = [];
  searchTimeout: any;

  defaultSatProducts = [
    { product_key: '01010101', description: 'No existe en el catálogo' },
    { product_key: '50202306', description: 'Refrescos / Bebidas' },
    { product_key: '50181900', description: 'Pan, galletas y dulces' },
    { product_key: '50192303', description: 'Botanas / Snacks' },
    { product_key: '50201708', description: 'Café o té' }
  ];

  defaultSatUnits = [
    { unit_key: 'H87', name: 'Pieza' },
    { unit_key: 'E48', name: 'Unidad de servicio' },
    { unit_key: 'KGM', name: 'Kilogramo' },
    { unit_key: 'LTR', name: 'Litro' },
    { unit_key: 'XPK', name: 'Paquete' }
  ];



  isAdmin(): boolean { const p = this.auth.sesion()?.idPerfil; return p === 1 || p === 3; }

  navegar(ruta: string) { this.router.navigate([ruta]); }

  ngOnInit() {
    this.cargarProductos();
    this.cargarCategorias();
    if (this.isSoporte()) {
      this.cargarCatalogosSoporte();
    }

    this.route.queryParams.subscribe(params => {
      if (params['modal'] === 'nuevo' && this.isAdmin()) {
        this.abrirModalNuevo();
      }
    });
  }

  cargarCatalogosSoporte() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/empresas`).subscribe(res => this.empresas.set(res));
    this.http.get<any[]>(`${environment.apiUrl}/pos/sucursales`).subscribe(res => this.sucursales.set(res));
  }

  cargarCategorias() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/categorias`).subscribe({
      next: (data) => this.categorias.set(data),
      error: (err) => (function(...args: any[]){})('Error cargando categorias', err)
    });
  }

  cargarProductos() {
    this.cargando.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/pos/productos`).subscribe({
      next: (data) => { this.productos.set(data); this.cargando.set(false); },
      error: (err) => { (function(...args: any[]){})('Error al cargar productos:', err); this.cargando.set(false); }
    });
  }

  getStockClass(prod: any): string {
    const stock = Number(prod.stockActual);
    const min = prod.stockMinimo != null && prod.stockMinimo !== '' ? Number(prod.stockMinimo) : 5;
    if (stock <= 0) return 'stock-cero';
    if (stock <= min) return 'stock-bajo';
    return 'stock-ok';
  }

  getStockLabel(prod: any): string {
    const stock = Number(prod.stockActual);
    const min = prod.stockMinimo != null && prod.stockMinimo !== '' ? Number(prod.stockMinimo) : 5;
    if (stock <= 0) return 'Sin Stock';
    if (stock <= min) return 'Stock Bajo';
    return 'Disponible';
  }

  getNombreCategoria(prod: any): string {
    return prod.categoria?.nombre || 'Sin categoría';
  }

  abrirModal(prod: any) {
  this.esNuevoProducto.set(false);
  
  this.nuevoProducto = { 
    ...prod,
    idCategoria: prod.categoria?.idCategoria ? Number(prod.categoria.idCategoria) : (prod.idCategoria ? Number(prod.idCategoria) : null),
    sumarStock: '',
    tipoArticulo: prod.tipoArticulo || 'Terminado',
    unidadMedida: prod.unidadMedida || 'Pza',
    precioCompra: prod.precioCompra || prod.precioUnitario || 0,
    utilidad: prod.utilidad || 18,
    aplicaDescuento: prod.aplicaDescuento || false,
    tipoDescuento: prod.tipoDescuento || 'porcentaje',
    descuento: prod.descuento || 0,
    aplicaIva: prod.aplicaIva || false,
      iva: prod.iva !== undefined ? Number(prod.iva) : 16,
      precioVenta: prod.precioVenta || prod.precioPublico || 0,
  };
  
  this.imagenPreview.set(prod.imagenUrl ? `${environment.apiUrl}${prod.imagenUrl}` : null);
  this.archivoImagen = null;
  this.satProductQuery = prod.claveProdServ ? (prod.claveProdServ) : '';
  this.satUnitQuery = prod.claveUnidad ? (prod.claveUnidad) : '';
  this.satProductsResults = [];
  this.satUnitsResults = [];
  this.mostrarModal.set(true);
}

  abrirModalNuevo() {
    this.esNuevoProducto.set(true);
    this.nuevoProducto = { nombre: '', precioCompra: 0, utilidad: 18, aplicaDescuento: false, tipoDescuento: 'porcentaje', descuento: 0, aplicaIva: false, iva: 16, precioVenta: 0, precioPublico: 0, precioUnitario: 0, stockMinimo: 0, codigoBarras: '', idCategoria: null, claveProdServ: '01010101', claveUnidad: 'H87', tipoArticulo: 'Terminado', unidadMedida: 'Pza' };
    this.imagenPreview.set(null);
    this.archivoImagen = null;
    this.satProductQuery = '01010101 - No existe en el catálogo';
    this.satUnitQuery = 'H87 - Pieza';
    this.satProductsResults = [];
    this.satUnitsResults = [];
    this.mostrarModal.set(true);
  }

  cerrarModal() {
    this.mostrarModal.set(false);
    this.nuevoProducto = {};
    this.archivoImagen = null;
    this.imagenPreview.set(null);
    this.satProductsResults = [];
    this.satUnitsResults = [];
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.archivoImagen = file;
      const reader = new FileReader();
      reader.onload = e => this.imagenPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  guardarProducto() {
    if (this.esNuevoProducto()) {
      this.crearNuevoProducto();
      return;
    }
    this.guardando.set(true);
    const id = this.nuevoProducto.idProducto;

    // 1. Si hay imagen nueva, subirla primero
    if (this.archivoImagen) {
      const formData = new FormData();
      formData.append('codigoBarras', this.nuevoProducto.codigoBarras || '');
      formData.append('imagen', this.archivoImagen);
      this.http.patch(`${environment.apiUrl}/pos/productos/${id}/imagen`, formData).subscribe({
        next: () => this.guardarDatosGenerales(id),
        error: () => this.guardando.set(false)
      });
    } else {
      this.guardarDatosGenerales(id);
    }
  }

  calcularPrecios() {
    const pc = Number(this.nuevoProducto.precioCompra || 0);
    const util = Number(this.nuevoProducto.utilidad || 0);
    const precioPublico = pc + (pc * util / 100);
    this.nuevoProducto.precioPublico = precioPublico;

    const aplicaDesc = this.nuevoProducto.aplicaDescuento;
    const tipoDesc = this.nuevoProducto.tipoDescuento || 'porcentaje';
    const descVal = Number(this.nuevoProducto.descuento || 0);

    let descuentoEfectivo = 0;
    if (aplicaDesc) {
      if (tipoDesc === 'monto') {
        descuentoEfectivo = descVal;
      } else {
        descuentoEfectivo = (precioPublico * descVal) / 100;
      }
    }

    const baseIva = precioPublico - descuentoEfectivo;
    const ivaCalc = this.nuevoProducto.aplicaIva ? (baseIva * (Number(this.nuevoProducto.iva !== undefined ? this.nuevoProducto.iva : 16) / 100)) : 0;
    
    this.nuevoProducto.precioVenta = baseIva + ivaCalc;
    this.nuevoProducto.precioUnitario = precioPublico;
  }

  private guardarDatosGenerales(id: number) {
    const payload = {
      nombre: this.nuevoProducto.nombre,
      codigoBarras: this.nuevoProducto.codigoBarras,
      precioCompra: Number(this.nuevoProducto.precioCompra || 0),
      precioUnitario: Number(this.nuevoProducto.precioPublico || 0),
        iva: Number(this.nuevoProducto.iva !== undefined ? this.nuevoProducto.iva : 16),
      utilidad: Number(this.nuevoProducto.utilidad || 0),
      precioPublico: Number(this.nuevoProducto.precioPublico || 0),
      aplicaDescuento: !!this.nuevoProducto.aplicaDescuento,
      tipoDescuento: this.nuevoProducto.tipoDescuento || 'porcentaje',
      descuento: Number(this.nuevoProducto.descuento || 0),
      aplicaIva: !!this.nuevoProducto.aplicaIva,
      precioVenta: Number(this.nuevoProducto.precioVenta || 0),
      stockMinimo: Number(this.nuevoProducto.stockMinimo || 0),
      claveProdServ: this.nuevoProducto.claveProdServ,
      claveUnidad: this.nuevoProducto.claveUnidad,
      sumarStock: this.nuevoProducto.sumarStock ? Number(this.nuevoProducto.sumarStock) : 0,
      tipoArticulo: this.nuevoProducto.tipoArticulo,
      unidadMedida: this.nuevoProducto.unidadMedida
    };

    this.http.patch(`${environment.apiUrl}/pos/productos/${id}`, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cargarProductos();
        this.cerrarModal();
      },
      error: (err) => {
        (function(...args: any[]){})('Error al guardar:', err);
        this.guardando.set(false);
      }
    });
  }

  private crearNuevoProducto() {
    if (!this.nuevoProducto.nombre?.trim()) {
      alert('El nombre del producto es obligatorio.');
      return;
    }
    this.guardando.set(true);
    const payload: any = {
      nombre: this.nuevoProducto.nombre,
      codigoBarras: this.nuevoProducto.codigoBarras || undefined,
      precioCompra: Number(this.nuevoProducto.precioCompra || 0),
      precioUnitario: Number(this.nuevoProducto.precioPublico || 0),
      iva: Number(this.nuevoProducto.iva !== undefined ? this.nuevoProducto.iva : 16),
      utilidad: Number(this.nuevoProducto.utilidad || 0),
      precioPublico: Number(this.nuevoProducto.precioPublico || 0),
      aplicaDescuento: !!this.nuevoProducto.aplicaDescuento,
      tipoDescuento: this.nuevoProducto.tipoDescuento || 'porcentaje',
      descuento: Number(this.nuevoProducto.descuento || 0),
      aplicaIva: !!this.nuevoProducto.aplicaIva,
      precioVenta: Number(this.nuevoProducto.precioVenta || 0),
      stockMinimo: Number(this.nuevoProducto.stockMinimo || 0),
      idCategoria: this.nuevoProducto.idCategoria ? Number(this.nuevoProducto.idCategoria) : undefined,
      claveProdServ: this.nuevoProducto.claveProdServ,
      claveUnidad: this.nuevoProducto.claveUnidad,
      tipoArticulo: this.nuevoProducto.tipoArticulo || 'Terminado',
      unidadMedida: this.nuevoProducto.unidadMedida || 'Pza'
    };

    const guardar = (imagenUrl?: string) => {
      if (imagenUrl) payload.imagenUrl = imagenUrl;
      this.http.post(`${environment.apiUrl}/pos/productos`, payload).subscribe({
        next: () => { this.guardando.set(false); this.cargarProductos(); this.cerrarModal(); },
        error: (err) => { (function(...args: any[]){})('Error al crear producto:', err); this.guardando.set(false); }
      });
    };

    if (this.archivoImagen) {
      const formData = new FormData();
      formData.append('imagen', this.archivoImagen);
      this.http.post<any>(`${environment.apiUrl}/pos/productos/imagen-temp`, formData).subscribe({
        next: (res) => guardar(res.imagenUrl),
        error: () => guardar() // si falla imagen, crea igual sin imagen
      });
    } else {
      guardar();
    }
  }

  imprimirCodigosDePrueba() {
    const productosConCodigo = this.productos().filter(p => p.codigoBarras);
    if (productosConCodigo.length === 0) return alert('No hay productos con código de barras.');

    let htmlContent = `
      <html>
        <head>
          <title>Códigos de Barras</title>
          <style>
            body { font-family: sans-serif; text-align: center; margin: 0; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
            .item { border: 1px dashed #ccc; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-inside: avoid; }
            .name { font-size: 11px; margin-bottom: 8px; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 16px; }
            svg { max-width: 100%; height: auto; }
            @media print { .no-print { display: none; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <h2 class="no-print">Códigos de Barras</h2>
          <div class="grid">
    `;

    productosConCodigo.forEach(p => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      try {
        JsBarcode(svg, p.codigoBarras, { format: "CODE128", displayValue: true, height: 40, width: 1.5, margin: 0, fontSize: 14 });
        const svgString = new XMLSerializer().serializeToString(svg);
        htmlContent += `<div class="item"><div class="name">${p.nombre}</div><div>${svgString}</div></div>`;
      } catch (e) { (function(...args: any[]){})(e); }
    });

    htmlContent += `</div><script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script></body></html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) { printWindow.document.write(htmlContent); printWindow.document.close(); }
  }

  // --- SAT Catalog Logic ---
  onSatProductSearch(showDefault = false) {
    clearTimeout(this.searchTimeout);
    if (!this.satProductQuery) {
      this.satProductsResults = showDefault ? this.defaultSatProducts : [];
      return;
    }
    if (this.satProductQuery.length < 3) {
      this.satProductsResults = this.defaultSatProducts.filter(p => p.description.toLowerCase().includes(this.satProductQuery.toLowerCase()) || p.product_key.includes(this.satProductQuery));
      return;
    }
    this.searchTimeout = setTimeout(() => {
      this.http.get<any[]>(`${environment.apiUrl}/pos/catalogo-sat/productos?q=${encodeURIComponent(this.satProductQuery)}`).subscribe({
        next: (data) => this.satProductsResults = data || [],
        error: (err) => (function(...args: any[]){})('Error searching SAT products', err)
      });
    }, 500);
  }

  selectSatProduct(prod: any) {
    this.nuevoProducto.claveProdServ = prod.product_key;
    this.satProductQuery = prod.product_key + ' - ' + prod.description;
    this.satProductsResults = [];
  }

  onSatUnitSearch(showDefault = false) {
    clearTimeout(this.searchTimeout);
    if (!this.satUnitQuery) {
      this.satUnitsResults = showDefault ? this.defaultSatUnits : [];
      return;
    }
    if (this.satUnitQuery.length < 2) {
      this.satUnitsResults = this.defaultSatUnits.filter(u => u.name.toLowerCase().includes(this.satUnitQuery.toLowerCase()) || u.unit_key.toLowerCase().includes(this.satUnitQuery.toLowerCase()));
      return;
    }
    this.searchTimeout = setTimeout(() => {
      this.http.get<any[]>(`${environment.apiUrl}/pos/catalogo-sat/unidades?q=${encodeURIComponent(this.satUnitQuery)}`).subscribe({
        next: (data) => this.satUnitsResults = data || [],
        error: (err) => (function(...args: any[]){})('Error searching SAT units', err)
      });
    }, 500);
  }

  selectSatUnit(unit: any) {
    this.nuevoProducto.claveUnidad = unit.unit_key;
    this.satUnitQuery = unit.unit_key + ' - ' + unit.name;
    this.satUnitsResults = [];
  }

  exportarExcel() {
    const data = this.productosFiltrados().map((p: any) => ({
      'Código': p.codigoBarras || 'N/A',
      'Nombre': p.nombre,
      'Categoría': p.categoria?.nombre || 'N/A',
      'Stock Actual': p.stockActual,
      'Precio Venta': p.precioPublico || 0,
      'Costo': p.precioUnitario || 0
    }));
    this.exportService.exportToExcel(data, 'Productos');
  }

  exportarPDF() {
    const headers = ['Código', 'Nombre', 'Categoría', 'Stock', 'Precio', 'Costo'];
    const data = this.productosFiltrados().map((p: any) => [
      p.codigoBarras || 'N/A',
      p.nombre,
      p.categoria?.nombre || 'N/A',
      p.stockActual?.toString() || '0',
      `$${p.precioPublico || 0}`,
      `$${p.precioUnitario || 0}`
    ]);
    this.exportService.exportToPdf(headers, data, 'Catálogo de Productos', 'Productos', 'l');
  }

  // --- Recetas ---
  abrirModalReceta(prod: any) {
    this.productoReceta.set(prod);
    this.mostrarModalReceta.set(true);
    this.cargarReceta(prod.idProducto);
  }

  cerrarModalReceta() {
    this.mostrarModalReceta.set(false);
    this.productoReceta.set(null);
    this.ingredientes.set([]);
    this.nuevoIngrediente.set({ idProductoHijo: null, cantidad: 1 });
  }

  cargarReceta(idProducto: number) {
    this.cargandoReceta.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/pos/productos/${idProducto}/recetas`).subscribe({
      next: (data) => {
        this.ingredientes.set(data || []);
        this.cargandoReceta.set(false);
      },
      error: (err) => {
        console.error('Error cargando receta', err);
        this.cargandoReceta.set(false);
      }
    });
  }

  agregarIngrediente() {
    const ingrediente = this.nuevoIngrediente();
    if (!ingrediente.idProductoHijo || !ingrediente.cantidad || ingrediente.cantidad <= 0) return;
    
    const idPadre = this.productoReceta()?.idProducto;
    if (!idPadre) return;

    this.cargandoReceta.set(true);
    this.http.post(`${environment.apiUrl}/pos/productos/${idPadre}/recetas`, ingrediente).subscribe({
      next: () => {
        this.nuevoIngrediente.set({ idProductoHijo: null, cantidad: 1 });
        this.cargarReceta(idPadre);
      },
      error: (err) => {
        console.error('Error agregando ingrediente', err);
        this.cargandoReceta.set(false);
      }
    });
  }

  eliminarIngrediente(idReceta: number) {
    const idPadre = this.productoReceta()?.idProducto;
    if (!idPadre) return;

    if (!confirm('¿Eliminar este ingrediente de la receta?')) return;

    this.cargandoReceta.set(true);
    this.http.delete(`${environment.apiUrl}/pos/recetas/${idReceta}`).subscribe({
      next: () => {
        this.cargarReceta(idPadre);
      },
      error: (err) => {
        console.error('Error eliminando ingrediente', err);
        this.cargandoReceta.set(false);
      }
    });
  }
}
