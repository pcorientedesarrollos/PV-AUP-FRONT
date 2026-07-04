import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  resumen = signal<{
    ventasHoy: number;
    totalClientes: number;
    movimientosHoy: number;
    ultimosMovimientos: any[];
    ventasSemana: number[];
    topProductos: any[];
  } | null>(null);

  cargando = signal(true);

  // Configuración de la gráfica
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    datasets: [
      {
        data: [1200, 1900, 3000, 2500, 2200, 3200, 4500],
        label: 'Ventas de la semana',
        fill: true,
        tension: 0.4,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        pointBackgroundColor: '#4f46e5',
      }
    ]
  };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: { beginAtZero: true, grid: { display: true, color: '#f3f4f6' } },
      x: { grid: { display: false } }
    }
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarResumen();
  }

  cargarResumen() {
    this.http.get<any>('http://localhost:3000/dashboard/resumen').subscribe({
      next: (data) => {
        this.resumen.set(data);
        
        if (data.ventasSemana) {
          this.lineChartData = {
            ...this.lineChartData,
            datasets: [
              { ...this.lineChartData.datasets[0], data: data.ventasSemana }
            ]
          };
        }

        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar dashboard', err);
        this.cargando.set(false);
      }
    });
  }
}
