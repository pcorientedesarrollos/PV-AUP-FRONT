import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  template: `<app-toast></app-toast><router-outlet />`,
})
export class App {
  private titleService = inject(Title);
  private document = inject(DOCUMENT);
  private auth = inject(AuthService);
  private theme = inject(ThemeService); // Instancia inicial para cargar el tema

  constructor() {
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
        
        // Calcular si es un color oscuro o claro para ajustar el texto
        // Formula simple de luminosidad
        const hex = colorPrincipal.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (luma < 128) {
            this.document.documentElement.style.setProperty('--texto-on-primario', '#ffffff');
          } else {
            this.document.documentElement.style.setProperty('--texto-on-primario', '#1e293b'); // slate-800
          }
        }
      } else {
        // Reset defaults
        this.document.documentElement.style.setProperty('--color-primario', '#f59e0b');
        this.document.documentElement.style.setProperty('--texto-on-primario', '#ffffff');
      }
    });
  }
}
