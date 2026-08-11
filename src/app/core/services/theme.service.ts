import { Injectable, signal, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'pos_theme';
  isDarkMode = signal(false);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.loadTheme();
    }
  }

  toggleTheme() {
    // Modo oscuro deshabilitado a petición del usuario.
  }

  private loadTheme() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Forzar modo claro siempre
    this.isDarkMode.set(false);
    localStorage.setItem(this.THEME_KEY, 'light');
    this.applyTheme();
  }

  private applyTheme() {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.classList.remove('dark');
  }
}
