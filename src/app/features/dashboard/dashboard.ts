import { environment } from '../../../environments/environment';
import { Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { SyncService } from '../../core/services/sync.service';
import { ThemeService } from '../../core/services/theme.service';
import { ConfigService } from '../../core/services/config.service';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
Chart.register(...registerables);
import { filter } from 'rxjs/operators';
import { ConfiguracionTicketComponent } from '../configuracion-ticket/configuracion-ticket.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfiguracionTicketComponent, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  menuAbierto = signal(typeof window !== 'undefined' && window.innerWidth >= 1024);
  mostrarModalConfig = false;


  // Chart
  public barChartLegend = false;
  public barChartPlugins = [];
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      { data: [], label: 'Ventas ($)', backgroundColor: 'rgba(234, 179, 8, 0.8)', borderRadius: 4, hoverBackgroundColor: 'rgba(234, 179, 8, 1)' }
    ]
  };
  public barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value;
          }
        }
      }
    }
  };

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
    this.http.get<any>(`${environment.apiUrl}/pos/dashboard/stats`).subscribe({
            next: (data) => { 
        this.stats.set(data); 
        this.cargandoStats.set(false);
        if (data && data.graficaDias) {
          this.barChartData = {
            labels: data.graficaDias.map((d: any) => d.fecha),
            datasets: [
              { data: data.graficaDias.map((d: any) => d.total), label: 'Ventas', backgroundColor: 'rgba(234, 179, 8, 0.8)', borderRadius: 4, hoverBackgroundColor: 'rgba(234, 179, 8, 1)' }
            ]
          };
        }
      },
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