import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../core/services/pos.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sucursales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-transparent max-w-7xl mx-auto w-full gap-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-black text-slate-800 tracking-tight">Gestion de Sucursales</h1>
          <p class="text-sm text-slate-500 mt-0.5">Solo el rol Soporte puede administrar sucursales y usuarios de manera global.</p>
        </div>
        <button (click)="abrirModalCrear()"
                class="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors flex items-center justify-center gap-2">
          <span>+</span> Nueva Sucursal
        </button>
      </div>

      <!-- Filtro Soporte -->
      @if (isSoporte()) {
        <div class="flex gap-4 p-4 bg-slate-900 rounded-xl shadow-inner border border-slate-700">
          <div class="flex items-center gap-3">
            <label class="text-sm font-bold text-amber-500 uppercase tracking-wider">🏢 Empresa:</label>
            <select [ngModel]="filtroEmpresa()" (ngModelChange)="filtroEmpresa.set($event)" class="bg-slate-700 border-slate-600 text-white rounded-lg px-3 py-1.5 focus:ring-amber-500 focus:border-amber-500">
              <option value="todas">Todas</option>
              @for (emp of empresas(); track emp.idEmpresa) {
                <option [ngValue]="emp.idEmpresa">{{emp.nombre}}</option>
              }
            </select>
          </div>
        </div>
      }

      <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div class="overflow-x-auto flex-1">
          <table class="w-full text-left text-sm text-slate-700">
            <thead class="sticky top-0 z-10 bg-slate-900 text-slate-200">
              <tr>
                <th class="py-3 px-4 font-semibold">ID</th>
                <th class="py-3 px-4 font-semibold">Nombre</th>
                <th class="py-3 px-4 font-semibold">Empresa</th>
                <th class="py-3 px-4 font-semibold">Direccion</th>
                <th class="py-3 px-4 font-semibold">Telefono</th>
                <th class="py-3 px-4 font-semibold">Estatus</th>
                <th class="py-3 px-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
            @for (s of sucursalesFiltradas(); track s.idSucursal) {
              <tr class="hover:bg-slate-50 transition-colors group">
                <td class="py-3 px-4 text-slate-500 font-medium">{{ s.idSucursal }}</td>
                <td class="py-3 px-4 font-semibold text-slate-800">{{ s.nombre }}</td>
                <td class="py-3 px-4 text-slate-600 font-medium">{{ s.empresa?.nombre || 'Ninguna' }}</td>
                <td class="py-3 px-4">{{ s.direccion }}</td>
                <td class="py-3 px-4">{{ s.telefono }}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-1 rounded text-xs font-bold"
                        [ngClass]="s.activo ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'">
                    {{ s.activo ? 'Activa' : 'Inactiva' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center space-x-2">
                  <button (click)="abrirModalEditar(s)" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors focus:outline-none" title="Editar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>
                  <button (click)="abrirModalUsuarios(s)" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-400 hover:text-sky-600 transition-colors focus:outline-none" title="Usuarios">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  </button>
                </td>
              </tr>
            }
              @if (sucursalesFiltradas().length === 0) {
                <tr>
                  <td colspan="7" class="py-12 text-center text-slate-500">
                    No hay sucursales registradas
                  </td>
                </tr>
              }
          </tbody>
        </table>
      </div>

      <!-- Modal Crear/Editar Sucursal -->
      @if (mostrarModal) {
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-700">
            <h2 class="text-xl font-bold text-amber-500 mb-5">{{ modoEdicion ? 'Editar Sucursal' : 'Nueva Sucursal' }}</h2>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
                <input [(ngModel)]="nuevaSucursal.nombre" placeholder="Ej. Sucursal Centro"
                       class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-slate-400 mb-1">Empresa</label>
                <select [(ngModel)]="nuevaSucursal.idEmpresa"
                        class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500">
                  <option [ngValue]="null">Selecciona una Empresa</option>
                  @for (emp of empresas(); track emp.idEmpresa) {
                    <option [ngValue]="emp.idEmpresa">{{emp.nombre}}</option>
                  }
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-400 mb-1">Direccion</label>
                <input [(ngModel)]="nuevaSucursal.direccion" placeholder="Calle, Numero, Colonia"
                       class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-400 mb-1">Telefono</label>
                <input [(ngModel)]="nuevaSucursal.telefono" placeholder="Ej. 555-123-4567"
                       class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
              </div>
              
              @if (modoEdicion) {
                <div class="flex items-center mt-4">
                  <input type="checkbox" [(ngModel)]="nuevaSucursal.activo" class="mr-2" id="activoCheck">
                  <label for="activoCheck" class="text-sm font-medium text-slate-400">Sucursal Activa</label>
                </div>
              }

              @if (!modoEdicion) {
                <div class="pt-4 border-t border-slate-700 mt-4">
                  <p class="text-sm font-bold text-amber-400 mb-3">Administrador Inicial</p>
                  <div class="space-y-3">
                    <div>
                      <label class="block text-sm font-medium text-slate-400 mb-1">Nombre Completo</label>
                      <input [(ngModel)]="nuevoAdmin.nombreCompleto" placeholder="Ej. Juan Perez"
                             class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-slate-400 mb-1">Usuario</label>
                      <input [(ngModel)]="nuevoAdmin.nombreUsuario" placeholder="usuario_admin"
                             class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-slate-400 mb-1">Contrasena</label>
                      <input type="password" [(ngModel)]="nuevoAdmin.contrasena" placeholder="Contrasena"
                             class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>
                </div>
              }
            </div>
            @if (error) {
              <p class="mt-3 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{{ error }}</p>
            }
            <div class="flex justify-end gap-3 mt-6">
              <button (click)="cerrarModal()" class="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
              <button (click)="guardar()" [disabled]="guardando"
                      class="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 px-5 py-2 rounded-lg font-bold transition-colors">
                {{ guardando ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal Gestión de Usuarios -->
      @if (mostrarModalUsuarios) {
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div class="bg-slate-800 rounded-2xl p-6 w-full max-w-4xl shadow-2xl border border-slate-700 flex flex-col md:flex-row gap-6 max-h-[90vh]">
            
            <!-- Columna Izquierda: Lista de usuarios de la sucursal -->
            <div class="flex-1 flex flex-col overflow-hidden">
              <h2 class="text-xl font-bold text-sky-400 mb-2">Usuarios de {{ sucursalSeleccionada?.nombre }}</h2>
              <p class="text-slate-400 text-sm mb-4">Usuarios actualmente asignados a esta sucursal.</p>
              
              <div class="flex-1 overflow-auto bg-slate-900 rounded-lg border border-slate-700 p-2">
                @for (u of usuariosDeSucursal(); track u.idUsuario) {
                  <div class="flex justify-between items-center p-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 rounded-lg transition-colors">
                    <div>
                      <p class="font-bold text-slate-200">{{ u.nombreUsuario }} <span class="text-xs text-slate-500 font-normal">({{ u.nombreCompleto }})</span></p>
                      <p class="text-xs text-slate-400">{{ u.rol }} | {{ u.activo ? 'Activo' : 'Inactivo' }}</p>
                    </div>
                  </div>
                }
                @if (usuariosDeSucursal().length === 0) {
                  <p class="text-center text-slate-500 py-4 text-sm">No hay usuarios en esta sucursal.</p>
                }
              </div>
            </div>

            <!-- Columna Derecha: Acciones -->
            <div class="w-full md:w-80 flex flex-col gap-6 overflow-y-auto pr-2">
              
              <!-- Formulario Crear Nuevo Usuario -->
              <div class="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <h3 class="text-md font-bold text-amber-500 mb-3">Crear Nuevo Usuario</h3>
                <div class="space-y-3 text-sm">
                  <input [(ngModel)]="nuevoUsuario.nombreCompleto" placeholder="Nombre Completo"
                         class="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
                  <input [(ngModel)]="nuevoUsuario.nombreUsuario" placeholder="Usuario Login"
                         class="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
                  <input type="password" [(ngModel)]="nuevoUsuario.contrasena" placeholder="Contrasena"
                         class="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500" />
                  <select [(ngModel)]="nuevoUsuario.rol"
                          class="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500">
                    <option value="Cajero">Cajero</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                  <button (click)="crearUsuarioEnSucursal()" [disabled]="guardando"
                          class="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 py-2 rounded-md font-bold transition-colors">
                    Crear y Asignar
                  </button>
                </div>
              </div>

              <!-- Formulario Vincular Existente -->
              <div class="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <h3 class="text-md font-bold text-emerald-500 mb-3">Vincular Usuario Existente</h3>
                <p class="text-xs text-slate-400 mb-3">Mover un usuario de otra sucursal a esta.</p>
                <div class="space-y-3 text-sm">
                  <select [(ngModel)]="usuarioAVincularId"
                          class="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500">
                    <option [ngValue]="null">-- Seleccionar Usuario --</option>
                    @for (gu of usuariosGlobales(); track gu.idUsuario) {
                      @if (gu.sucursal?.idSucursal !== sucursalSeleccionada?.idSucursal) {
                        <option [ngValue]="gu.idUsuario">{{ gu.nombreUsuario }} ({{ gu.rol }} - Sucursal: {{ gu.sucursal?.nombre || 'Ninguna' }})</option>
                      }
                    }
                  </select>
                  <button (click)="vincularUsuario()" [disabled]="guardando || !usuarioAVincularId"
                          class="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-900 py-2 rounded-md font-bold transition-colors">
                    Mover a esta Sucursal
                  </button>
                </div>
              </div>

              <div class="mt-auto pt-4 flex justify-end">
                <button (click)="cerrarModalUsuarios()" class="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">Cerrar</button>
              </div>

            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SucursalesComponent implements OnInit {
  private posService = inject(PosService);
  private auth = inject(AuthService);

  isSoporte = computed(() => this.auth.sesion()?.idPerfil === 3);
  filtroEmpresa = signal<number | 'todas'>('todas');

  sucursales = signal<any[]>([]);
  empresas = signal<any[]>([]);
  
  sucursalesFiltradas = computed(() => {
    const fEmp = this.filtroEmpresa();
    if (fEmp === 'todas') return this.sucursales();
    return this.sucursales().filter(s => s.empresa?.idEmpresa === fEmp);
  });
  
  mostrarModal = false;
  modoEdicion = false;
  guardando = false;
  error = '';
  nuevaSucursal: any = {
    nombre: '',
    direccion: '',
    telefono: '',
    activo: true,
    idEmpresa: null
  };
  nuevoAdmin = { nombreUsuario: '', contrasena: '', nombreCompleto: '' };

  // Modal Usuarios
  mostrarModalUsuarios = false;
  sucursalSeleccionada: any = null;
  usuariosDeSucursal = signal<any[]>([]);
  usuariosGlobales = signal<any[]>([]);
  
  nuevoUsuario = { nombreUsuario: '', contrasena: '', nombreCompleto: '', rol: 'Cajero' };
  usuarioAVincularId: number | null = null;

  ngOnInit() {
    this.cargar();
    this.cargarEmpresas();
  }

  cargar() {
    this.posService.getSucursales().subscribe({
      next: (data) => this.sucursales.set(data),
      error: (err) => console.error(err)
    });
  }

  cargarEmpresas() {
    this.posService.getEmpresas().subscribe({
      next: (data) => this.empresas.set(data),
      error: (err) => console.error(err)
    });
  }

  abrirModalCrear() {
    this.modoEdicion = false;
    this.mostrarModal = true;
    this.error = '';
    this.nuevaSucursal = { nombre: '', direccion: '', telefono: '', activo: true, idEmpresa: null };
    this.nuevoAdmin = { nombreUsuario: '', contrasena: '', nombreCompleto: '' };
  }

  abrirModalEditar(sucursal: any) {
    this.modoEdicion = true;
    this.sucursalSeleccionada = sucursal;
    this.mostrarModal = true;
    this.error = '';
    this.nuevaSucursal = { 
      ...sucursal,
      idEmpresa: sucursal.empresa?.idEmpresa || null
    };
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  guardar() {
    this.error = '';
    this.guardando = true;

    if (this.modoEdicion) {
      const payload = {
        ...this.nuevaSucursal,
        empresa: { idEmpresa: this.nuevaSucursal.idEmpresa }
      };

      this.posService.actualizarSucursal(this.sucursalSeleccionada.idSucursal, payload).subscribe({
        next: () => {
          this.guardando = false;
          this.cerrarModal();
          this.cargar();
        },
        error: (err: any) => {
          this.guardando = false;
          this.error = 'Error al actualizar: ' + (err?.error?.message ?? 'Error desconocido');
        }
      });
    } else {
      const payload = {
        sucursal: {
          ...this.nuevaSucursal,
          empresa: { idEmpresa: this.nuevaSucursal.idEmpresa }
        },
        usuario: this.nuevoAdmin
      };
      this.posService.crearSucursal(payload).subscribe({
        next: () => {
          this.guardando = false;
          this.cerrarModal();
          this.cargar();
        },
        error: (err: any) => {
          this.guardando = false;
          this.error = 'Error al crear sucursal: ' + (err?.error?.message ?? 'Error desconocido');
        }
      });
    }
  }

  // --- Usuarios ---
  abrirModalUsuarios(sucursal: any) {
    this.sucursalSeleccionada = sucursal;
    this.mostrarModalUsuarios = true;
    this.nuevoUsuario = { nombreUsuario: '', contrasena: '', nombreCompleto: '', rol: 'Cajero' };
    this.usuarioAVincularId = null;
    this.cargarUsuarios(sucursal.idSucursal);
  }

  cerrarModalUsuarios() {
    this.mostrarModalUsuarios = false;
    this.sucursalSeleccionada = null;
  }

  cargarUsuarios(idSucursal: number) {
    this.posService.getUsuariosGlobal().subscribe({
      next: (data) => {
        this.usuariosGlobales.set(data);
        const locales = data.filter(u => u.sucursal?.idSucursal === idSucursal);
        this.usuariosDeSucursal.set(locales);
      },
      error: () => {
        this.usuariosGlobales.set([]);
        this.usuariosDeSucursal.set([]);
      }
    });
  }

  crearUsuarioEnSucursal() {
    if (!this.nuevoUsuario.nombreUsuario || !this.nuevoUsuario.contrasena) return;
    this.guardando = true;
    this.posService.crearUsuario({
      usuario: this.nuevoUsuario.nombreUsuario,
      password: this.nuevoUsuario.contrasena,
      nombreCompleto: this.nuevoUsuario.nombreCompleto,
      rol: this.nuevoUsuario.rol,
      idSucursal: this.sucursalSeleccionada.idSucursal
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.nuevoUsuario = { nombreUsuario: '', contrasena: '', nombreCompleto: '', rol: 'Cajero' };
        this.cargarUsuarios(this.sucursalSeleccionada.idSucursal);
      },
      error: (err: any) => {
        this.guardando = false;
        alert('Error: ' + (err?.error?.message ?? 'Error desconocido'));
      }
    });
  }

  vincularUsuario() {
    if (!this.usuarioAVincularId) return;
    this.guardando = true;
    this.posService.actualizarUsuario(this.usuarioAVincularId, {
      idSucursal: this.sucursalSeleccionada.idSucursal
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.usuarioAVincularId = null;
        this.cargarUsuarios(this.sucursalSeleccionada.idSucursal);
      },
      error: (err: any) => {
        this.guardando = false;
        alert('Error: ' + (err?.error?.message ?? 'Error desconocido'));
      }
    });
  }
}