import { Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { SyncService } from '../../core/services/sync.service';
import { ThemeService } from '../../core/services/theme.service';
import { ConfigService } from '../../core/services/config.service';
import { filter } from 'rxjs/operators';
import { ConfiguracionTicketComponent } from '../configuracion-ticket/configuracion-ticket.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfiguracionTicketComponent],
  templateUrl: './dashboard.html',
})
export class DashboardComponent implements OnInit {
  menuAbierto = signal(typeof window !== 'undefined' && window.innerWidth >= 1024);
  mostrarModalConfig = false;

  // Stats
  stats = signal<any>(null);
  cargandoStats = signal(true);
  rutaActual = signal('');

  constructor(
    public router: Router,
    public auth: AuthService,
    public sync: SyncService,
    public theme: ThemeService,
    public config: ConfigService,
    private http: HttpClient
  ) {
    this.rutaActual.set(this.router.url);
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.rutaActual.set(event.urlAfterRedirects || event.url);
    });
  }


  ngOnInit() {
    this.cargarStats();
  }

  cargarStats() {
    this.cargandoStats.set(true);
    if (this.auth.sesion()?.idPerfil === 3) {
      setTimeout(() => {
        this.stats.set({
          isSoporte: true,
          empresas: 24,
          sucursales: 89,
          usuarios: 342,
          estado: 'Óptimo (99.9% Uptime)',
          terminalesOffline: 3,
          versionAPI: 'v2.4.1 (Stable)',
          ultimaCopia: new Date().toISOString()
        });
        this.cargandoStats.set(false);
      }, 500);
      return;
    }
    this.http.get<any>('http://localhost:3000/pos/dashboard/stats').subscribe({
      next: (data) => { this.stats.set(data); this.cargandoStats.set(false); },
      error: (err) => { console.error('Error cargando stats', err); this.cargandoStats.set(false); }
    });
  }

  getBarHeightPx(valor: number): string {
    const s = this.stats();
    if (!s) return '4px';
    const max = Math.max(...s.graficaDias.map((d: any) => d.total), 1);
    const height = Math.round((valor / max) * 100);
    return `${Math.max(4, height)}px`; // Minimum 4px so it's visible, max 100px
  }

  toggleMenu() { this.menuAbierto.update(v => !v); }
  toggleMenuMobile() { if (window.innerWidth < 1024) this.menuAbierto.set(false); }
  cerrarSesion() { this.auth.logout(); this.router.navigate(['/login']); }
  navegar(ruta: string) { this.router.navigate([ruta]); }
  isActive(ruta: string): boolean { return this.rutaActual().includes(ruta); }

  @HostListener('window:keydown', ['$event'])
  manejarAtajos(event: KeyboardEvent) {
    switch (event.key) {
      case 'F1': event.preventDefault(); this.navegar('/pos'); break;
      case 'F3': event.preventDefault(); this.navegar('/productos'); break;
      case 'F4': event.preventDefault(); this.navegar('/inventario'); break;
    }
  }
}
