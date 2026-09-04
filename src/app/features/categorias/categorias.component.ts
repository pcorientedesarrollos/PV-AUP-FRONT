import { environment } from '../../../environments/environment';
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PosService } from '../../core/services/pos.service';
import { AuthService } from '../../core/services/auth.service';
import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginacionComponent],
  template: `
    <div class="h-full flex flex-col bg-transparent max-w-7xl mx-auto w-full gap-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-black text-slate-800 tracking-tight">Categorías de Productos</h1>
          <p class="text-sm text-slate-500 mt-0.5">Gestiona las categorías de tu empresa</p>
        </div>
        <div class="flex items-center gap-3">

          <button (click)="abrirModal()" class="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors flex items-center justify-center gap-2">
            <span>+</span> Nueva Categoría
          </button>
        </div>
      </div>

      <!-- Filtros y Buscador -->
      <div class="flex flex-col md:flex-row gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
            </svg>
          </div>
          <input type="search" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" placeholder="Buscar por ID o nombre..." class="pl-9 w-full rounded-md border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500">
        </div>

        @if (isSoporte()) {
          <div class="flex items-center gap-3">
            <label class="text-sm font-bold text-slate-700">🏢 Empresa:</label>
            <select [ngModel]="filtroEmpresa()" (ngModelChange)="filtroEmpresa.set($event)" class="bg-white border-slate-300 text-slate-800 rounded-lg px-3 py-1.5 shadow-sm focus:border-amber-500 focus:ring-amber-500">
              <option value="todas">Todas</option>
              @for (emp of empresas(); track emp.idEmpresa) {
                <option [ngValue]="emp.idEmpresa">{{emp.nombre}}</option>
              }
            </select>
          </div>
        }
      </div>

      <!-- Contenido -->
      <div class="flex-1 overflow-hidden flex flex-col pb-4">
        @if (!vistaTarjetas()) {
          <div class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-0 relative z-10">
            <div class="overflow-x-auto flex-1 custom-scrollbar">
              <table class="w-full text-left text-sm text-slate-700 ">
                <thead class="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                  <tr>
                    <th class="py-3 px-4 font-semibold w-16">ID</th>
                    <th class="py-3 px-4 font-semibold w-24">Color</th>
                    <th class="py-3 px-4 font-semibold">Nombre</th>
                    <th class="py-3 px-4 font-semibold text-center w-32">Productos</th>
                    <th class="py-3 px-4 font-semibold w-32">Estado</th>
                    <th class="py-3 px-4 font-semibold text-center w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                  @for (cat of categoriasPaginadas(); track cat.idCategoria) {
                    <tr class="hover:bg-slate-50/80 transition-colors group">
                      <td class="py-3 px-4 text-slate-500 font-medium">#{{cat.idCategoria}}</td>
                      <td class="py-3 px-4">
                        <div class="w-6 h-6 rounded-full border border-slate-200 shadow-sm" [ngClass]="cat.color"></div>
                      </td>
                      <td class="py-3 px-4 font-semibold text-slate-800">
                        {{cat.nombre}}
                      </td>
                      <td class="py-3 px-4 text-center font-bold text-slate-600">
                        {{cat.totalProductos || 0}}
                      </td>
                      <td class="py-3 px-4">
                        <span class="px-2 py-1 rounded text-xs font-bold" 
                              [ngClass]="cat.activo ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'">
                          {{cat.activo ? 'ACTIVO' : 'INACTIVO'}}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-center">
                        <button (click)="abrirModal(cat)" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors focus:outline-none" title="Editar">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="6" class="p-8 text-center text-slate-500">
                        No hay categorías registradas.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @else {
          <!-- Vista Grid de Tarjetas -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar h-full">
            @for (cat of categoriasPaginadas(); track cat.idCategoria) {
              <div class="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col overflow-hidden relative group">
                <!-- Barra de Color Superior -->
                <div class="h-2 w-full" [ngClass]="cat.color"></div>
                <div class="p-5 flex-1 flex flex-col">
                  <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-slate-400">#{{cat.idCategoria}}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold" 
                          [ngClass]="cat.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'">
                      {{cat.activo ? 'ACTIVO' : 'INACTIVO'}}
                    </span>
                  </div>
                  <h3 class="text-lg font-bold text-slate-800 mb-1">{{cat.nombre}}</h3>
                  
                  <div class="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
                    <div class="flex flex-col">
                      <span class="text-xs text-slate-500 font-medium">Productos</span>
                      <span class="text-sm font-black text-slate-700">{{cat.totalProductos || 0}}</span>
                    </div>
                    <button (click)="abrirModal(cat)" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-500 transition-colors border border-slate-200 hover:border-amber-200" title="Editar">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            } @empty {
              <div class="col-span-full bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
                No hay categorías registradas.
              </div>
            }
          </div>
        }
      </div>
      <app-paginacion [paginaActual]="paginaActual()" [totalPaginas]="totalPaginas()" [totalRegistros]="categoriasFiltradas().length" [tamanoPagina]="tamanoPagina()" (paginaCambiada)="paginaActual.set($event)"></app-paginacion>
    </div>

    <!-- Modal Formulario -->
    @if (modalAbierto()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" (click)="cerrarModal()"></div>
        <div class="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <h2 class="text-xl font-bold text-white mb-6">{{ catActual() ? 'Editar' : 'Nueva' }} Categoría</h2>
          
          <form (submit)="guardar($event)" class="space-y-4">
            
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Nombre de la Categoría</label>
              <input type="text" [(ngModel)]="formulario.nombre" name="nombre" required
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-600 transition-all"
                     placeholder="Ej. Cera">
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-400 mb-2">Color</label>
              <div class="flex flex-wrap gap-2">
                @for (c of colores; track c) {
                  <button type="button" (click)="formulario.color = c" 
                          class="w-8 h-8 rounded border-2 transition-all"
                          [ngClass]="[c, formulario.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100']"></button>
                }
              </div>
            </div>

            @if (catActual()) {
              <div class="flex items-center gap-3 py-2">
                <input type="checkbox" id="activo" [(ngModel)]="formulario.activo" name="activo"
                       class="w-5 h-5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900">
                <label for="activo" class="text-sm font-medium text-slate-300 select-none">Categoría Activa</label>
              </div>
            }

            @if (error()) {
              <div class="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <p class="text-sm text-rose-400">{{ error() }}</p>
              </div>
            }

            <div class="flex justify-end gap-3 mt-8">
              <button type="button" (click)="cerrarModal()" class="px-4 py-2 text-slate-400 hover:text-white transition-colors font-medium">
                Cancelar
              </button>
              <button type="submit" [disabled]="cargando()" class="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-bold rounded-lg shadow-lg hover:shadow-amber-500/20 transition-all flex items-center gap-2">
                @if (cargando()) {
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                } @else {
                  Guardar
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class CategoriasComponent implements OnInit {
  categorias = signal<any[]>([]);
  empresas = signal<any[]>([]);
  filtroEmpresa = signal<number | 'todas'>('todas');
  busqueda = signal('');
  
  isSoporte = computed(() => this.auth.sesion()?.idPerfil === 3);

  categoriasFiltradas = computed(() => {
    const fEmpresa = this.filtroEmpresa();
    const term = this.busqueda().toLowerCase();

    let result = this.categorias();

    if (fEmpresa !== 'todas') {
      result = result.filter(c => c.empresa?.idEmpresa === fEmpresa);
    }

    if (term) {
      result = result.filter(c => 
        c.nombre.toLowerCase().includes(term) ||
        c.idCategoria.toString().includes(term)
      );
    }

    return result;
  });
  modalAbierto = signal(false);
  catActual = signal<any>(null);
  categoriaOriginal: any = null;
  cargando = signal(false);
  error = signal('');
  vistaTarjetas = signal(false);

  paginaActual = signal(1);
  tamanoPagina = signal(10);
  
  totalPaginas = computed(() => Math.ceil(this.categoriasFiltradas().length / this.tamanoPagina()) || 1);

  categoriasPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    const fin = inicio + this.tamanoPagina();
    return this.categoriasFiltradas().slice(inicio, fin);
  });

  colores = [
    'bg-slate-600', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 
    'bg-indigo-500', 'bg-purple-500', 'bg-rose-500', 'bg-orange-500'
  ];

  formulario = {
    nombre: '',
    color: 'bg-slate-600',
    activo: true
  };

  constructor(private posService: PosService, private http: HttpClient, public auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.cargar();
    if (this.isSoporte()) {
      this.http.get<any[]>(`${environment.apiUrl}/pos/empresas`).subscribe(res => this.empresas.set(res));
    }
  }

  verProductos(idCategoria: number) {
    this.router.navigate(['/productos'], { queryParams: { categoria: idCategoria } });
  }

  cargar() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/categorias`).subscribe({
      next: (res) => this.categorias.set(res),
      error: (err) => console.error(err)
    });
  }

  abrirModal(cat?: any) {
    this.error.set('');
    if (cat) {
      this.catActual.set(cat);
      this.formulario = {
        nombre: cat.nombre,
        color: cat.color || 'bg-slate-600',
        activo: cat.activo
      };
    } else {
      this.catActual.set(null);
      this.formulario = {
        nombre: '',
        color: 'bg-slate-600',
        activo: true
      };
    }
    this.categoriaOriginal = JSON.parse(JSON.stringify(this.catActual() || { nombre: "", descripcion: "" }));
    this.modalAbierto.set(true);
  }

  cerrarModal(forzar = false) {
    if (!forzar && this.categoriaOriginal && this.modalAbierto()) {
      const current = JSON.parse(JSON.stringify(this.catActual() || { nombre: "", descripcion: "" }));
      if (JSON.stringify(current) !== JSON.stringify(this.categoriaOriginal)) {
        if (!confirm('¿Estás seguro que deseas salir? Tienes cambios sin guardar.')) {
          return;
        }
      }
    }
    this.modalAbierto.set(false);
  }

  guardar(e: Event) {
    e.preventDefault();
    if (!this.formulario.nombre) {
      this.error.set('El nombre es requerido');
      return;
    }

    this.cargando.set(true);
    const peticion = this.catActual()
      ? this.posService.actualizarCategoria(this.catActual().idCategoria, this.formulario)
      : this.posService.crearCategoria(this.formulario);

    peticion.subscribe({
      next: () => {
        this.cargar();
        this.cerrarModal(true);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Ocurrió un error al guardar');
        this.cargando.set(false);
      }
    });
  }
}
