import { Component, signal, OnInit, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../../core/services/pos.service';
import { Producto } from '../../../core/interfaces';
import { CameraScannerComponent } from '../../../shared/components/camera-scanner/camera-scanner.component';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, CameraScannerComponent],
  templateUrl: './catalogo.component.html',
  host: { class: 'flex flex-col h-full relative' },
})
export class CatalogoComponent implements OnInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  public enfocarBuscador() {
    if (this.searchInput) {
      this.searchInput.nativeElement.focus();
    }
  }

  getPrecioFinalConIva(producto: any): number {
    const base = Number(producto.precioPublico) || Number(producto.precioUnitario) || Number(producto.precioVenta) || 0;
    const desc = this.getDescuentoMonetario(producto);
    const sub = base - desc;
    if (producto.aplicaIva !== false) {
      const iva = producto.iva !== undefined ? Number(producto.iva) : 16;
      return sub * (1 + (iva / 100));
    }
    return sub;
  }

  getPrecioBaseConIva(producto: any): number {
    const base = Number(producto.precioPublico) || Number(producto.precioUnitario) || Number(producto.precioVenta) || 0;
    if (producto.aplicaIva !== false) {
      const iva = producto.iva !== undefined ? Number(producto.iva) : 16;
      return base * (1 + (iva / 100));
    }
    return base;
  }

  getDescuentoMonetario(producto: any): number {
    if (!producto.aplicaDescuento) return 0;
    const desc = Number(producto.descuento) || 0;
    if (producto.tipoDescuento === 'porcentaje') {
      const precioBase = Number(producto.precioPublico) || Number(producto.precioUnitario) || Number(producto.precioVenta) || 0;
      return (precioBase * desc) / 100;
    }
    return desc;
  }

  apiUrl = environment.apiUrl;
  productos = signal<Producto[]>([]);
  busqueda = signal('');
  filtroFamilia = signal<number | 'todas'>('todas');
  cargando = signal(true);
  vista = signal<'tarjetas' | 'lista'>('lista');
  soloConStock = signal(false);
  escaneandoConCamara = signal(false);
  ultimosEscaneos = signal<{texto: string, exito: boolean, hora: Date}[]>([]);
  categorias = signal<any[]>([]);

  productosFiltrados = signal<Producto[]>([]);
  paginaActual = signal(1);
  totalPaginas = signal(1);
  totalRegistros = signal(0);

  constructor(public pos: PosService) {}

  ngOnInit() {
    this.cargarCategorias();
    this.buscarEnBackend('', 1);
  }

  getColorFamilia(idCategoria: number | undefined): string {
    if (!idCategoria) return 'bg-slate-600';
    const cat = this.categorias().find(c => c.idCategoria === idCategoria);
    if (cat && cat.color) return cat.color;
    return 'bg-amber-500';
  }

  cargarCategorias() {
    this.pos.getCategorias().subscribe({
      next: (data) => this.categorias.set(data),
      error: (err) => console.error('Error cargando categorias', err)
    });
  }

  buscarEnBackend(term: string, page: number = 1) {
    this.cargando.set(true);
    let params: any = { page: page, limit: 20 };
    if (term) params.search = term;
    if (this.filtroFamilia() !== 'todas') params.categoria = this.filtroFamilia();
    if (this.soloConStock()) params.stock = '1';

    this.pos.getProductos(params.page, 20, params.search || '').subscribe({
      next: (res: any) => {
        this.productosFiltrados.set(res.data || []);
        this.paginaActual.set(res.page || res.meta?.currentPage || 1);
        this.totalPaginas.set(res.totalPages || res.meta?.totalPages || 1);
        this.totalRegistros.set(res.total || res.meta?.totalItems || 0);
        this.cargando.set(false);
      },
      error: () => {
        this.productosFiltrados.set([]);
        this.cargando.set(false);
      }
    });
  }

  private searchTimeout: any;
  busquedaModificada(term: string) {
    this.busqueda.set(term);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.buscarEnBackend(term, 1);
    }, 300);
  }

  filtroFamiliaModificado(familia: number | 'todas') {
    this.filtroFamilia.set(familia);
    this.buscarEnBackend(this.busqueda(), 1);
  }

  soloConStockModificado(checked: boolean) {
    this.soloConStock.set(checked);
    this.buscarEnBackend(this.busqueda(), 1);
  }

  cambiarPagina(delta: number) {
    const nueva = this.paginaActual() + delta;
    if (nueva > 0 && nueva <= this.totalPaginas()) {
      this.buscarEnBackend(this.busqueda(), nueva);
    }
  }

  agregar(producto: Producto, silent: boolean = false): boolean {
    return this.pos.agregarAlCarrito(producto, false, silent);
  }

  onEnterBuscador(event: Event) {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.buscarEnBackend(this.busqueda(), 1);
  }


  getDescuentoEfectivo(prod: any): number {
    if (!prod.aplicaDescuento || !prod.descuento) return 0;
    const descVal = Number(prod.descuento);
    if (prod.tipoDescuento === 'monto') {
      return descVal;
    }
    return (Number(prod.precioPublico || 0) * descVal) / 100;
  }

  getPrecioVentaFinal(prod: any): number {
    const base = Number(prod.precioPublico || 0) - this.getDescuentoEfectivo(prod);
    const iva = prod.aplicaIva ? (base * (Number(prod.iva !== undefined ? prod.iva : 16) / 100)) : 0;
    return base + iva;
  }
  
  getPrecioVentaSinDescuento(prod: any): number {
    const base = Number(prod.precioPublico || 0);
    const iva = prod.aplicaIva ? (base * (Number(prod.iva !== undefined ? prod.iva : 16) / 100)) : 0;
    return base + iva;
  }

  onCameraScan(codigo: string) {
    this.busqueda.set(codigo);
    this.pos.buscarProductoPorCodigo(codigo).subscribe({
      next: (prod) => {
        if (prod) {
          const success = this.agregar(prod, true);
          if (success) {
            this.ultimosEscaneos.update(list => [{texto: prod.nombre, exito: true, hora: new Date()}, ...list].slice(0, 4));
          } else {
            this.ultimosEscaneos.update(list => [{texto: `Sin stock: ${prod.nombre}`, exito: false, hora: new Date()}, ...list].slice(0, 4));
          }
          setTimeout(() => {
            this.busqueda.set('');
            this.buscarEnBackend('', 1);
          }, 800);
        } else {
          this.ultimosEscaneos.update(list => [{texto: `No encontrado: ${codigo}`, exito: false, hora: new Date()}, ...list].slice(0, 4));
        }
      }
    });
  }

  cerrarCamara() {
    this.escaneandoConCamara.set(false);
    this.ultimosEscaneos.set([]);
  }
}



