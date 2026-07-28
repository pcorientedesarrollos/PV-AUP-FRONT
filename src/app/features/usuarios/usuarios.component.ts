import { environment } from '../../../environments/environment';
import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

interface Usuario {
  idUsuario: number;
  usuario: string;
  idPerfil: number;
  oculto: number;
  sucursal?: any;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent implements OnInit {
  usuarios = signal<Usuario[]>([]);
  cargando = signal(true);
  
  filtroEmpresa = signal<number | 'todas'>('todas');
  filtroSucursal = signal<number | 'todas'>('todas');
  empresas = signal<any[]>([]);
  sucursales = signal<any[]>([]);
  
  sucursalesFiltradas = computed(() => {
    const fEmpresa = this.filtroEmpresa();
    if (fEmpresa === 'todas') return this.sucursales();
    return this.sucursales().filter(s => s.empresa?.idEmpresa === fEmpresa);
  });
  
  usuariosFiltrados = computed(() => {
    let list = this.usuarios();
    const fEmpresa = this.filtroEmpresa();
    if (fEmpresa !== 'todas') {
      list = list.filter(u => u.sucursal?.empresa?.idEmpresa === fEmpresa);
    }
    const fSucursal = this.filtroSucursal();
    if (fSucursal !== 'todas') {
      list = list.filter(u => u.sucursal?.idSucursal === fSucursal);
    }
    return list;
  });
  
  // Estado del modal
  modalAbierto = signal(false);
  guardando = signal(false);
  editandoId = signal<number | null>(null);

  // Formulario
  nuevoUsuario = {
    usuario: '',
    password: '',
    idPerfil: 2, // Por defecto Cajero
    idPersonalOM: 0,
    app: 1,
    oculto: 0
  };

  constructor(private http: HttpClient, public auth: AuthService) {}

  isSoporte(): boolean {
    return this.auth.sesion()?.idPerfil === 3;
  }

  ngOnInit() {
    this.cargarUsuarios();
    if (this.isSoporte()) {
      this.http.get<any[]>(`${environment.apiUrl}/pos/empresas`).subscribe(res => this.empresas.set(res));
      this.http.get<any[]>(`${environment.apiUrl}/pos/sucursales`).subscribe(res => this.sucursales.set(res));
    }
  }

  cargarUsuarios() {
    this.cargando.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/pos/usuarios`).subscribe({
      next: (data) => {
        const mapeados = data.map(u => ({
          idUsuario: u.idUsuario,
          usuario: u.nombreUsuario,
          idPerfil: u.rol === 'Administrador' ? 1 : (u.rol === 'Soporte' ? 3 : 2),
          oculto: u.activo ? 0 : 1,
          sucursal: u.sucursal
        }));
        if (this.isSoporte()) {
          this.usuarios.set(mapeados);
        } else {
          this.usuarios.set(mapeados.filter(u => u.oculto !== 1)); // Ocultamos los inactivos a los demás
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar usuarios', err);
        this.cargando.set(false);
      }
    });
  }

  abrirModal(usuarioEditar?: Usuario) {
    if (usuarioEditar) {
      this.editandoId.set(usuarioEditar.idUsuario);
      this.nuevoUsuario = {
        usuario: usuarioEditar.usuario,
        password: '', // Dejar en blanco para no modificar si no es necesario
        idPerfil: usuarioEditar.idPerfil,
        idPersonalOM: 0,
        app: 1,
        oculto: 0
      };
    } else {
      this.editandoId.set(null);
      this.nuevoUsuario = {
        usuario: '',
        password: '',
        idPerfil: 2,
        idPersonalOM: 0,
        app: 1,
        oculto: 0
      };
    }
    this.modalAbierto.set(true);
  }

  cerrarModal() {
    this.modalAbierto.set(false);
    this.editandoId.set(null);
  }

  guardarUsuario() {
    if (!this.nuevoUsuario.usuario) {
      alert('El nombre de usuario es obligatorio.');
      return;
    }

    const isEdit = this.editandoId() !== null;

    if (!isEdit && !this.nuevoUsuario.password) {
      alert('La contraseña es obligatoria para nuevos usuarios.');
      return;
    }

    this.guardando.set(true);
    
    // Aseguramos que el ID de perfil se envíe como número
    this.nuevoUsuario.idPerfil = Number(this.nuevoUsuario.idPerfil);

    // Preparar el payload: eliminar password si está vacío en edición
    const payload: any = { ...this.nuevoUsuario };
    if (isEdit && !payload.password) {
      delete payload.password;
    }

    const request = isEdit 
      ? this.http.patch(`${environment.apiUrl}/pos/usuarios/${this.editandoId()}`, payload)
      : this.http.post(`${environment.apiUrl}/pos/usuarios`, payload);

    request.subscribe({
      next: () => {
        this.cargarUsuarios();
        this.cerrarModal();
        this.guardando.set(false);
      },
      error: (err) => {
        console.error('Error al guardar', err);
        alert('Ocurrió un error al intentar guardar el usuario.');
        this.guardando.set(false);
      }
    });
  }

  getNombrePerfil(idPerfil: number): string {
    if (idPerfil === 3) return 'Soporte';
    return idPerfil === 1 ? 'Administrador' : 'Cajero / Empleado';
  }

  toggleActivo(usr: Usuario) {
    if (!this.isSoporte()) {
      alert('No tienes permisos para desactivar/activar usuarios. Solo Soporte puede hacer esto.');
      return;
    }
    const accion = usr.oculto === 1 ? 'activar' : 'desactivar';
    if (confirm(`¿Estás seguro de que deseas ${accion} este usuario?`)) {
      this.http.patch(`${environment.apiUrl}/pos/usuarios/${usr.idUsuario}`, { oculto: usr.oculto === 1 ? false : true }).subscribe({
        next: () => this.cargarUsuarios(),
        error: (err) => console.error('Error cambiando estado', err)
      });
    }
  }
}
