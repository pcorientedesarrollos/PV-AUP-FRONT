import { Injectable, signal, effect } from '@angular/core';
import { AuthService } from './auth.service';

export interface AppConfig {
  empresaNombre: string;
  rfc: string;
  direccion: string;
  telefono: string;
  email: string;
  logoUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  
  // Default values
  public readonly defaultConfig: AppConfig = {
    empresaNombre: 'AUP POS',
    rfc: 'XAXX010101000',
    direccion: 'Av. Principal 123, Centro',
    telefono: '555-123-4567',
    email: 'contacto@empresa.com',
    logoUrl: '/logo.png' // Default logo
  };

  public config = signal<AppConfig>(this.defaultConfig);
  private currentEmpresaId = 'default';

  constructor(private auth: AuthService) {
    effect(() => {
      const sesion = this.auth.sesion();
      if (sesion?.empresa) {
        this.currentEmpresaId = String(sesion.empresa.idEmpresa);
        const backendConfig: AppConfig = {
          ...this.defaultConfig,
          empresaNombre: sesion.empresa.nombre || this.defaultConfig.empresaNombre,
          logoUrl: sesion.empresa.logoUrl || this.defaultConfig.logoUrl
        };
        this.loadConfig(backendConfig);
      } else {
        this.currentEmpresaId = 'default';
        this.loadConfig(this.defaultConfig);
      }
    });
  }

  private loadConfig(baseConfig: AppConfig) {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(`aup_app_config_${this.currentEmpresaId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          this.config.set({ ...baseConfig, ...parsed });
          return;
        } catch (e) {
          console.error('Error loading config from localStorage', e);
        }
      }
    }
    this.config.set(baseConfig);
  }

  public saveConfig(newConfig: AppConfig) {
    this.config.set(newConfig);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(`aup_app_config_${this.currentEmpresaId}`, JSON.stringify(newConfig));
    }
  }
}
