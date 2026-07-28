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
    this.isDarkMode.set(!this.isDarkMode());
    this.applyTheme();
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.THEME_KEY, this.isDarkMode() ? 'dark' : 'light');
    }
  }

  private loadTheme() {
    if (!isPlatformBrowser(this.platformId)) return;
    const saved = localStorage.getItem(this.THEME_KEY);
    if (saved === 'dark') {
      this.isDarkMode.set(true);
    } else if (saved === 'light') {
      this.isDarkMode.set(false);
    } else {
      // Default to light mode for now
      this.isDarkMode.set(false);
    }
    this.applyTheme();
  }

  private applyTheme() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isDarkMode()) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
