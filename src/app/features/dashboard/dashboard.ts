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
  menuSearch = signal('');

  matchSearch(keywords: string): boolean {
    const q = this.menuSearch().toLowerCase().trim();
    if (!q) return true;
    return keywords.toLowerCase().includes(q);
  }

  // Chart
  public barChartLegend = true;
  public barChartPlugins = [];
  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      { data: [], label: 'Esta Semana', backgroundColor: 'rgba(234, 179, 8, 0.8)', borderRadius: 4, hoverBackgroundColor: 'rgba(234, 179, 8, 1)' },
      { data: [], label: 'Semana Anterior', backgroundColor: 'rgba(156, 163, 175, 0.5)', borderRadius: 4, hoverBackgroundColor: 'rgba(156, 163, 175, 0.8)' }
    ]
  };
  public barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: {
        callbacks: {
          title: function(tooltipItems: any) {
              const item = tooltipItems[0];
              const dataset = item.dataset;
              if (dataset.fechasReales) {
                return dataset.fechasReales[item.dataIndex];
              }
              return item.label;
            },
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

  public pieChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' }
    }
  };
  public pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Efectivo', 'Tarjeta', 'Transferencia'],
    datasets: [{ data: [0, 0, 0], backgroundColor: ['#22c55e', '#3b82f6', '#8b5cf6'] }]
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
              { data: data.graficaDias.map((d: any) => d.total), label: 'Esta Semana', backgroundColor: 'rgba(234, 179, 8, 0.8)', borderRadius: 4, hoverBackgroundColor: 'rgba(234, 179, 8, 1)' },
              { data: data.graficaDiasAnterior ? data.graficaDiasAnterior.map((d: any) => d.total) : [], label: 'Semana Anterior', backgroundColor: 'rgba(156, 163, 175, 0.5)', borderRadius: 4, hoverBackgroundColor: 'rgba(156, 163, 175, 0.8)', fechasReales: data.graficaDiasAnterior ? data.graficaDiasAnterior.map((d: any) => d.fecha) : [] } as any
            ]
          };
        }
        if (data && data.metodosPago) {
          this.pieChartData = {
            labels: ['Efectivo', 'Tarjeta', 'Transferencia'],
            datasets: [{ 
              data: [data.metodosPago.Efectivo || 0, data.metodosPago.Tarjeta || 0, data.metodosPago.Transferencia || 0], 
              backgroundColor: ['#22c55e', '#3b82f6', '#8b5cf6'] 
            }]
          }
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