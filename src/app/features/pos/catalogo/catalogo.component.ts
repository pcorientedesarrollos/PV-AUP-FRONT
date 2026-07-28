import { Component, signal, OnInit, computed } from '@angular/core';
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

  productosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const familia = this.filtroFamilia();

    return this.productos().filter((p) => {
      // Filtro Stock
      if (this.soloConStock()) {
        const stock = p.stockActual || 0;
        if (stock <= 0) return false;
      }

      // Filtro de texto
      const coincideTexto = !q || 
        p.nombre.toLowerCase().includes(q) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(q)) ||
        (p.idProducto.toString() === q);

      // Filtro de familia
      let coincideFamilia = true;
      if (familia !== 'todas') {
        const id = p.categoria?.idCategoria || p.idCategoria || 0;
        coincideFamilia = (id === familia);
      }

      return coincideTexto && coincideFamilia;
    });
  });

  constructor(public pos: PosService) {}



  getColorFamilia(idCategoria: number | undefined): string {
    if (!idCategoria) return 'bg-slate-600';
    const cat = this.categorias().find(c => c.idCategoria === idCategoria);
    if (cat && cat.color) return cat.color;
    
    // Default color if none specified
    return 'bg-amber-500';
  }

  ngOnInit() {
    this.cargarProductos();
    this.cargarCategorias();
  }

  cargarCategorias() {
    this.pos.getCategorias().subscribe({
      next: (data) => this.categorias.set(data),
      error: (err) => console.error('Error cargando categorias', err)
    });
  }

  cargarProductos() {
    this.cargando.set(true);
    this.pos.getProductos().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
      },
    });
  }

  agregar(producto: Producto, silent: boolean = false): boolean {
    return this.pos.agregarAlCarrito(producto, false, silent);
  }

  onEnterBuscador(event: Event) {
    const filtrados = this.productosFiltrados();
    if (filtrados.length === 1) {
      this.agregar(filtrados[0]);
      this.busqueda.set(''); // Limpia el buscador para el siguiente scan

      // Vuelve a enfocar el input para seguir escaneando
      setTimeout(() => {
        const input = event.target as HTMLInputElement;
        if (input) input.focus();
      }, 0);
    }
  }

  onCameraScan(codigo: string) {
    // Asigna el código al buscador brevemente
    this.busqueda.set(codigo);
    
    // Busca el producto directamente
    const prod = this.productos().find(p => p.codigoBarras === codigo || p.idProducto.toString() === codigo);
    if (prod) {
      const success = this.agregar(prod, true); // silent = true
      if (success) {
        this.ultimosEscaneos.update(list => [{texto: prod.nombre, exito: true, hora: new Date()}, ...list].slice(0, 4));
      } else {
        this.ultimosEscaneos.update(list => [{texto: `Sin stock: ${prod.nombre}`, exito: false, hora: new Date()}, ...list].slice(0, 4));
      }
      // Limpia el buscador después de un breve delay
      setTimeout(() => this.busqueda.set(''), 800);
    } else {
      this.ultimosEscaneos.update(list => [{texto: `No encontrado: ${codigo}`, exito: false, hora: new Date()}, ...list].slice(0, 4));
    }
  }

  cerrarCamara() {
    this.escaneandoConCamara.set(false);
    this.ultimosEscaneos.set([]); // Limpiar historial al cerrar
  }
}
