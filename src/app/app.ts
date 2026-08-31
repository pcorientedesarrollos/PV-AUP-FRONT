import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { filter } from 'rxjs/operators';

import { ToastComponent } from './shared/components/toast/toast.component';
import { ConfirmModalComponent } from './shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, ConfirmModalComponent],
  template: `
    @if (auth.isImpersonating()) {
      <div class="bg-orange-500 text-white px-4 py-2 flex items-center justify-between text-sm font-bold shadow-md z-50 relative">
        <div class="flex items-center gap-2">
          <span>⚠️</span>
          <span>Modo Suplantación: Operando en la sucursal "{{ auth.sesion()?.sucursalNombre || 'N/A' }}" de "{{ auth.sesion()?.empresa?.nombre || 'N/A' }}"</span>
        </div>
        <button (click)="auth.restaurarSesion()" class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors text-xs uppercase tracking-wider border border-white/40">
          🔙 Volver a mi sesión original
        </button>
      </div>
    }
    <app-toast></app-toast>
    <app-confirm-modal></app-confirm-modal>
    <router-outlet />
  `,
})
export class App {
  private titleService = inject(Title);
  private document = inject(DOCUMENT);
  public auth = inject(AuthService);
  private theme = inject(ThemeService);
  private router = inject(Router);
  private swUpdate = inject(SwUpdate);

  private readonly LAST_ROUTE_KEY = 'lastRoute';
  // Rutas que NO deben persistirse
  private readonly SKIP_ROUTES = ['/login', '/pos', '/', ''];

  constructor() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => {
          this.swUpdate.activateUpdate().then(() => document.location.reload());
        });
    }

    // Guardar la ruta actual en cada navegación exitosa
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const url: string = e.urlAfterRedirects || e.url || '';
      if (url && !this.SKIP_ROUTES.some(r => url === r || url.startsWith('/pos'))) {
        sessionStorage.setItem(this.LAST_ROUTE_KEY, url);
      }
    });

    // Si el usuario ya tiene sesión y hay una ruta guardada, restaurarla
    if (this.auth.isLoggedIn()) {
      const isInitialRoutePos = typeof window !== 'undefined' && window.location.pathname.startsWith('/pos');
      if (!isInitialRoutePos) {
        const saved = sessionStorage.getItem(this.LAST_ROUTE_KEY);
        if (saved && !this.SKIP_ROUTES.includes(saved)) {
          // Navegar a la ruta guardada después de que el router esté listo
          setTimeout(() => this.router.navigateByUrl(saved), 0);
        }
      }
    }

    effect(() => {
      const empresa = this.auth.sesion()?.empresa?.nombre;
      const logoUrl = this.auth.sesion()?.empresa?.logoUrl;
      
      // Cambiar título
      if (empresa) {
        this.titleService.setTitle(`${empresa} — Punto de Venta`);
      } else {
        this.titleService.setTitle('AUP POS — Punto de Venta');
      }

      // Cambiar favicon
      const link: HTMLLinkElement = this.document.querySelector("link[rel*='icon']") || this.document.createElement('link');
      link.type = 'image/png';
      link.rel = 'icon';
      link.href = logoUrl ? logoUrl : 'icon.png';
      this.document.getElementsByTagName('head')[0].appendChild(link);

      // Cambiar variables CSS de tema
      const colorPrincipal = this.auth.sesion()?.empresa?.colorPrincipal;
      if (colorPrincipal) {
        this.document.documentElement.style.setProperty('--color-primario', colorPrincipal);
        
        const hex = colorPrincipal.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (luma < 128) {
            this.document.documentElement.style.setProperty('--texto-on-primario', '#ffffff');
          } else {
            this.document.documentElement.style.setProperty('--texto-on-primario', '#1e293b');
          }
        }
      } else {
        this.document.documentElement.style.setProperty('--color-primario', '#f59e0b');
        this.document.documentElement.style.setProperty('--texto-on-primario', '#ffffff');
      }
    });
  }
}
