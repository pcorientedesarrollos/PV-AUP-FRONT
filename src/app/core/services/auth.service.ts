import { environment } from '../../../environments/environment';
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { LoginPayload, Sesion } from '../interfaces';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiUrl;

  // Estado de sesión con signals
  private _sesion = signal<Sesion | null>(this.cargarSesion());
  readonly sesion = this._sesion.asReadonly();
  readonly isLoggedIn = computed(() => this._sesion() !== null);
  readonly usuario = computed(() => this._sesion()?.usuario ?? '');

  constructor(private http: HttpClient, private router: Router) {}

  login(payload: LoginPayload) {
    return this.http.post<Sesion>(`${this.API}/pos/auth/login`, payload).pipe(
      tap((sesion) => {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('sesion', JSON.stringify(sesion));
        }
        this._sesion.set(sesion);
      })
    );
  }

  logout() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem('sesion');
      sessionStorage.removeItem('turnoAbierto');
      window.location.href = '/login'; // Hard reload to clear SPA state (cart, etc)
    } else {
      this._sesion.set(null);
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return this._sesion()?.access_token || null;
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

  private cargarSesion(): Sesion | null {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = sessionStorage.getItem('sesion');
    return raw ? JSON.parse(raw) : null;
  }
}
