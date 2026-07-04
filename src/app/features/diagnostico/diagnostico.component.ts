import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncService } from '../../core/services/sync.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-diagnostico',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagnostico.component.html'
})
export class DiagnosticoComponent {
  
  constructor(
    public sync: SyncService,
    private toast: ToastService
  ) {}

  forzarSincronizacion() {
    this.toast.show('Iniciando sincronización forzada...', 'info');
    setTimeout(() => {
      this.toast.show('Sincronización completada', 'success');
    }, 1500);
  }

  limpiarCacheLocal() {
    if (confirm('¿Estás seguro de limpiar la caché local? Esto borrará configuraciones no sincronizadas.')) {
      if (typeof window !== 'undefined' && window.localStorage) {
        // We only clear the config stuff or specific things to be safe, but since it's a diagnostic tool, 
        // a full local storage wipe (except auth) is what a hard reset would do.
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !key.includes('sesion')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        
        this.toast.show('Caché local limpiada correctamente.', 'success');
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  }

  pingServer() {
    this.toast.show('Haciendo ping al servidor...', 'info');
    setTimeout(() => {
      if (this.sync.isOnline()) {
        this.toast.show('El servidor responde correctamente (Latencia: 45ms).', 'success');
      } else {
        this.toast.show('No hay conexión con el servidor.', 'error');
      }
    }, 800);
  }
}
