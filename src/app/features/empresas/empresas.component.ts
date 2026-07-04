import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../core/services/pos.service';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-transparent max-w-7xl mx-auto w-full gap-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-black text-slate-800 tracking-tight">Catálogo de Empresas</h1>
          <p class="text-sm text-slate-500 mt-0.5">Gestiona las empresas (inquilinos) que usan el sistema</p>
        </div>
        <button (click)="abrirModal()" class="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors flex items-center justify-center gap-2">
          <span>+</span> Nueva Empresa
        </button>
      </div>

      <!-- Tabla -->
      <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div class="overflow-x-auto flex-1">
          <table class="w-full text-left text-sm text-slate-700">
            <thead class="sticky top-0 z-10 bg-slate-900 text-slate-200">
              <tr>
                <th class="py-3 px-4 font-semibold w-16">ID</th>
                <th class="py-3 px-4 font-semibold w-24">Logo</th>
                <th class="py-3 px-4 font-semibold">Nombre de la Empresa</th>
                <th class="py-3 px-4 font-semibold w-32">Estado</th>
                <th class="py-3 px-4 font-semibold text-center w-32">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (emp of empresas(); track emp.idEmpresa) {
                <tr class="hover:bg-slate-50 transition-colors group">
                  <td class="py-3 px-4 text-slate-500 font-medium">#{{emp.idEmpresa}}</td>
                  <td class="py-3 px-4">
                    <img [src]="emp.logoUrl || '/logo.png'" alt="Logo" class="w-10 h-10 object-contain rounded bg-slate-100 p-1 border border-slate-200">
                  </td>
                  <td class="py-3 px-4">
                    <span class="font-semibold text-slate-800">{{emp.nombre}}</span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded text-xs font-bold" 
                          [ngClass]="emp.activa ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'">
                      {{emp.activa ? 'ACTIVA' : 'INACTIVA'}}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <button (click)="abrirModal(emp)" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors focus:outline-none" title="Editar">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="p-8 text-center text-slate-500">
                    No hay empresas registradas.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Formulario -->
    @if (modalAbierto()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" (click)="cerrarModal()"></div>
        <div class="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <h2 class="text-xl font-bold text-white mb-6">{{ empActual() ? 'Editar' : 'Nueva' }} Empresa</h2>
          
          <form (submit)="guardar($event)" class="space-y-4">
            
            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Nombre Comercial</label>
              <input type="text" [(ngModel)]="formulario.nombre" name="nombre" required
                     class="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-600 transition-all"
                     placeholder="Ej. Mi Tiendita Abarrotes">
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-400 mb-1">Logo Comercial</label>
              <div class="flex gap-2">
                <input type="text" [(ngModel)]="formulario.logoUrl" name="logoUrl"
                       class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-600 transition-all"
                       placeholder="Sube una imagen o pega URL">
                <button type="button" (click)="fileInput.click()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700">
                  Subir
                </button>
                <input type="file" #fileInput (change)="subirLogo($event)" class="hidden" accept="image/*">
              </div>
              <p class="text-xs text-slate-500 mt-1">Sube una imagen o coloca la ruta local/web directamente.</p>
            </div>

            @if (formulario.logoUrl) {
              <div class="mt-2 p-2 bg-slate-950 rounded border border-slate-800 flex justify-center">
                <img [src]="formulario.logoUrl" class="h-12 object-contain" alt="Preview">
              </div>
            }

            @if (empActual()) {
              <div class="flex items-center gap-3 py-2">
                <input type="checkbox" id="activa" [(ngModel)]="formulario.activa" name="activa"
                       class="w-5 h-5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900">
                <label for="activa" class="text-sm font-medium text-slate-300 select-none">Empresa Activa</label>
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
export class EmpresasComponent implements OnInit {
  empresas = signal<any[]>([]);
  modalAbierto = signal(false);
  empActual = signal<any>(null);
  cargando = signal(false);
  error = signal('');

  formulario = {
    nombre: '',
    logoUrl: '/logo.png',
    activa: true
  };

  constructor(private posService: PosService, private http: HttpClient) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.http.get<any[]>('http://localhost:3000/pos/empresas').subscribe({
      next: (res) => this.empresas.set(res),
      error: (err) => console.error(err)
    });
  }

  abrirModal(emp?: any) {
    this.error.set('');
    if (emp) {
      this.empActual.set(emp);
      this.formulario = {
        nombre: emp.nombre,
        logoUrl: emp.logoUrl,
        activa: emp.activa
      };
    } else {
      this.empActual.set(null);
      this.formulario = {
        nombre: '',
        logoUrl: '/logo.png',
        activa: true
      };
    }
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
  }

  guardar(e: Event) {
    e.preventDefault();
    if (!this.formulario.nombre) {
      this.error.set('El nombre de la empresa es requerido');
      return;
    }

    this.cargando.set(true);
    const peticion = this.empActual()
      ? this.posService.actualizarEmpresa(this.empActual().idEmpresa, this.formulario)
      : this.posService.crearEmpresa(this.formulario);

    peticion.subscribe({
      next: () => {
        this.cargar();
        this.cerrarModal();
        this.cargando.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Ocurrió un error al guardar la empresa');
        this.cargando.set(false);
      }
    });
  }

  subirLogo(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    this.cargando.set(true);
    this.http.post<any>('http://localhost:3000/pos/upload-logo', formData).subscribe({
      next: (res) => {
        // La API devuelve { url: '/uploads/archivo.png' }
        // Pero como Angular corre en el 4200 y el API en el 3000, agregamos el host base
        this.formulario.logoUrl = 'http://localhost:3000' + res.url;
        this.cargando.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Error al subir la imagen');
        this.cargando.set(false);
      }
    });
  }
}
