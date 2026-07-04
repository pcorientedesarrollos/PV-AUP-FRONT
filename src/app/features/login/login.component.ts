import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  credenciales = { user: '', password: '' };
  cargando = signal(false);
  mostrarPassword = signal(false);
  empresaNombre = signal('AUP POS');
  empresaLogo = signal('/logo.png');
  empresaColor = signal('#f59e0b');

  constructor(private auth: AuthService, private router: Router, private http: HttpClient, private toast: ToastService) {
    // Si ya está logueado, ir al POS
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/pos']);
    }
  }

  onLogin() {
    if (!this.credenciales.user || !this.credenciales.password) {
      this.toast.show('Por favor ingresa usuario y contraseña.', 'warning');
      return;
    }
    this.cargando.set(true);

    this.auth.login(this.credenciales).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/pos']);
      },
      error: (err) => {
        this.cargando.set(false);
        this.toast.show(
          err.status === 401
            ? 'Usuario o contraseña incorrectos.'
            : 'Error de conexión. Verifica que el servidor esté activo.',
          'error'
        );
      },
    });
  }

  buscarEmpresa() {
    if (!this.credenciales.user) return;
    this.http.get<any>(`http://localhost:3000/pos/empresa-por-usuario/${this.credenciales.user}`).subscribe({
      next: (res) => {
        this.empresaNombre.set(res.nombre || 'AUP POS');
        this.empresaLogo.set(res.logoUrl || '/logo.png');
        this.empresaColor.set(res.colorPrincipal || '#f59e0b');
      },
      error: () => {
        this.empresaNombre.set('AUP POS');
        this.empresaLogo.set('/logo.png');
        this.empresaColor.set('#f59e0b');
      }
    });
  }

  saltarLogin() {
    this.cargando.set(true);
    this.auth.bypassLogin().subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/pos']);
      },
      error: () => {
        this.cargando.set(false);
        this.toast.show('Error al acceder. Verifica que la BD tenga usuarios.', 'error');
      }
    });
  }
}
