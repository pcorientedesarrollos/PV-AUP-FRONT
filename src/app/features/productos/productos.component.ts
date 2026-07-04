import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { BarcodeDirective } from '../../shared/directives/barcode.directive';
import JsBarcode from 'jsbarcode';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeDirective],
  templateUrl: './productos.component.html',
})
export class ProductosComponent implements OnInit {
  productos = signal<any[]>([]);
  cargando = signal(false);

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
      if (stock === 'sin-stock') coincideStock = st <= 0;
      else if (stock === 'stock-bajo') coincideStock = st > 0 && st <= 10;
      else if (stock === 'disponible') coincideStock = st > 10;

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

  // Estadísticas (siempre sobre todos los productos, no el filtro)
  totalProductos = computed(() => this.productos().length);
  sinStock = computed(() => this.productos().filter(p => Number(p.stockActual) <= 0).length);
  stockBajo = computed(() => this.productos().filter(p => {
    const s = Number(p.stockActual);
    const min = Number(p.stockMinimo) > 0 ? Number(p.stockMinimo) : 5;
    return s > 0 && s <= min;
  }).length);
  disponible = computed(() => this.productos().filter(p => {
    const s = Number(p.stockActual);
    const min = Number(p.stockMinimo) > 0 ? Number(p.stockMinimo) : 5;
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

  // Modal código de barras
  codigoBarrasVisualizar = signal<string | null>(null);

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

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute, public auth: AuthService) {}

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
    this.http.get<any[]>('http://localhost:3000/pos/empresas').subscribe(res => this.empresas.set(res));
    this.http.get<any[]>('http://localhost:3000/pos/sucursales').subscribe(res => this.sucursales.set(res));
  }

  cargarCategorias() {
    this.http.get<any[]>('http://localhost:3000/pos/categorias').subscribe({
      next: (data) => this.categorias.set(data),
      error: (err) => console.error('Error cargando categorias', err)
    });
  }

  cargarProductos() {
    this.cargando.set(true);
    this.http.get<any[]>('http://localhost:3000/pos/productos').subscribe({
      next: (data) => { this.productos.set(data); this.cargando.set(false); },
      error: (err) => { console.error('Error al cargar productos:', err); this.cargando.set(false); }
    });
  }

  getStockClass(prod: any): string {
    const stock = Number(prod.stockActual);
    const min = Number(prod.stockMinimo || 5);
    if (stock <= 0) return 'stock-cero';
    if (stock <= min) return 'stock-bajo';
    return 'stock-ok';
  }

  getStockLabel(prod: any): string {
    const stock = Number(prod.stockActual);
    const min = Number(prod.stockMinimo || 5);
    if (stock <= 0) return 'Sin Stock';
    if (stock <= min) return 'Stock Bajo';
    return 'Disponible';
  }

  getNombreCategoria(prod: any): string {
    return prod.categoria?.nombre || 'Sin categoría';
  }

  abrirModal(prod: any) {
    this.esNuevoProducto.set(false);
    this.nuevoProducto = { ...prod };
    this.imagenPreview.set(prod.imagenUrl ? `http://localhost:3000${prod.imagenUrl}` : null);
    this.archivoImagen = null;
    this.satProductQuery = prod.claveProdServ ? (prod.claveProdServ + ' (Actual)') : '';
    this.satUnitQuery = prod.claveUnidad ? (prod.claveUnidad + ' (Actual)') : '';
    this.satProductsResults = [];
    this.satUnitsResults = [];
    this.mostrarModal.set(true);
  }

  abrirModalNuevo() {
    this.esNuevoProducto.set(true);
    this.nuevoProducto = { nombre: '', precioUnitario: 0, precioMayoreo: null, stockMinimo: 0, codigoBarras: '', idCategoria: null, claveProdServ: '01010101', claveUnidad: 'H87' };
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
      this.http.patch(`http://localhost:3000/pos/productos/${id}/imagen`, formData).subscribe({
        next: () => this.guardarDatosGenerales(id),
        error: () => this.guardando.set(false)
      });
    } else {
      this.guardarDatosGenerales(id);
    }
  }

  private guardarDatosGenerales(id: number) {
    const payload = {
      nombre: this.nuevoProducto.nombre,
      codigoBarras: this.nuevoProducto.codigoBarras,
      precioUnitario: Number(this.nuevoProducto.precioUnitario),
      precioPublico: Number(this.nuevoProducto.precioPublico || this.nuevoProducto.precioUnitario),
      precioMayoreo: this.nuevoProducto.precioMayoreo ? Number(this.nuevoProducto.precioMayoreo) : undefined,
      stockMinimo: Number(this.nuevoProducto.stockMinimo || 0),
      claveProdServ: this.nuevoProducto.claveProdServ,
      claveUnidad: this.nuevoProducto.claveUnidad,
    };

    this.http.patch(`http://localhost:3000/pos/productos/${id}`, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cargarProductos();
        this.cerrarModal();
      },
      error: (err) => {
        console.error('Error al guardar:', err);
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
      precioUnitario: Number(this.nuevoProducto.precioUnitario || 0),
      precioMayoreo: this.nuevoProducto.precioMayoreo ? Number(this.nuevoProducto.precioMayoreo) : undefined,
      stockMinimo: Number(this.nuevoProducto.stockMinimo || 0),
      idCategoria: this.nuevoProducto.idCategoria ? Number(this.nuevoProducto.idCategoria) : undefined,
      claveProdServ: this.nuevoProducto.claveProdServ,
      claveUnidad: this.nuevoProducto.claveUnidad,
    };

    const guardar = (imagenUrl?: string) => {
      if (imagenUrl) payload.imagenUrl = imagenUrl;
      this.http.post('http://localhost:3000/pos/productos', payload).subscribe({
        next: () => { this.guardando.set(false); this.cargarProductos(); this.cerrarModal(); },
        error: (err) => { console.error('Error al crear producto:', err); this.guardando.set(false); }
      });
    };

    if (this.archivoImagen) {
      const formData = new FormData();
      formData.append('imagen', this.archivoImagen);
      this.http.post<any>('http://localhost:3000/pos/productos/imagen-temp', formData).subscribe({
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
      } catch (e) { console.error(e); }
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
      this.http.get<any[]>(`http://localhost:3000/pos/catalogo-sat/productos?q=${encodeURIComponent(this.satProductQuery)}`).subscribe({
        next: (data) => this.satProductsResults = data || [],
        error: (err) => console.error('Error searching SAT products', err)
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
      this.http.get<any[]>(`http://localhost:3000/pos/catalogo-sat/unidades?q=${encodeURIComponent(this.satUnitQuery)}`).subscribe({
        next: (data) => this.satUnitsResults = data || [],
        error: (err) => console.error('Error searching SAT units', err)
      });
    }, 500);
  }

  selectSatUnit(unit: any) {
    this.nuevoProducto.claveUnidad = unit.unit_key;
    this.satUnitQuery = unit.unit_key + ' - ' + unit.name;
    this.satUnitsResults = [];
  }
}
