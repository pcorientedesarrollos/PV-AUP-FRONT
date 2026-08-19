import { environment } from '../../../environments/environment';
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { LoginPayload, Sesion } from '../interfaces';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiUrl;

  // Estado Real
  private _sesionReal = signal<Sesion | null>(this.cargarSesionReal());
  readonly sesionReal = this._sesionReal.asReadonly();

  // Estado Activo (El que toda la app lee)
  private _sesion = signal<Sesion | null>(this.cargarSesionActiva() || this.cargarSesionReal());
  readonly sesion = this._sesion.asReadonly();
  
  readonly isLoggedIn = computed(() => this._sesion() !== null);
  readonly usuario = computed(() => this._sesion()?.usuario ?? '');
  readonly isImpersonating = computed(() => !!(this._sesion() as any)?.['isImpersonating']);

  constructor(private http: HttpClient, private router: Router) {}

  login(payload: LoginPayload) {
    return this.http.post<Sesion>(this.API + '/pos/auth/login', payload).pipe(
      tap((sesion) => {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('sesion', JSON.stringify(sesion));
          sessionStorage.removeItem('sesionActiva');
        }
        this._sesionReal.set(sesion);
        this._sesion.set(sesion);
      })
    );
  }

  
  tienePermiso(permiso: string): boolean {
    const s = this.sesion();
    if (!s) return false;
    if (s.idPerfil === 1 || s.idPerfil === 3) return true; // Admin o Soporte tienen todo
    return s.permisos ? s.permisos.includes(permiso) : false;
  }

  logout() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('sesion');
      sessionStorage.removeItem('sesionActiva');
      sessionStorage.removeItem('turnoAbierto');
      window.location.href = '/login';
    } else {
      this._sesionReal.set(null);
      this._sesion.set(null);
      this.router.navigate(['/login']);
    }
  }

  impersonar(nuevaSesionInfo: Partial<Sesion>) {
    const actual = this._sesionReal();
    if (!actual) return;
    const simulada: any = { ...actual, ...nuevaSesionInfo, isImpersonating: true };
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('sesionActiva', JSON.stringify(simulada));
    }
    this._sesion.set(simulada);
    window.location.href = '/dashboard'; 
  }

  restaurarSesion() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('sesionActiva');
    }
    this._sesion.set(this._sesionReal());
    window.location.href = '/dashboard';
  }

  getToken(): string | null {
    return this._sesionReal()?.access_token || null; // Always use real token for authentication
  }

  turnoAbierto(): boolean {
    if (this._sesion()?.idPerfil === 3) return true;
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    return sessionStorage.getItem('turnoAbierto') === 'true';
  }

  marcarTurnoAbierto() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('turnoAbierto', 'true');
    }
  }

  cerrarTurno() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('turnoAbierto');
    }
  }

  private cargarSesionReal(): Sesion | null {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = sessionStorage.getItem('sesion');
    return raw ? JSON.parse(raw) : null;
  }

  private cargarSesionActiva(): Sesion | null {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = sessionStorage.getItem('sesionActiva');
    return raw ? JSON.parse(raw) : null;
  }
}
