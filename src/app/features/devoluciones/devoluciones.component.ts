import { environment } from '../../../environments/environment';
import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';

import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';

@Component({
  selector: 'app-devoluciones',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginacionComponent],
  templateUrl: './devoluciones.component.html',
})
export class DevolucionesComponent implements OnInit {
  readonly API = environment.apiUrl + '/pos';

  devoluciones = signal<any[]>([]);
  cargando = signal(true);
  busqueda = signal('');
  devolucionSeleccionada = signal<any>(null);

  devolucionesFiltradas = computed(() => {
    const q = this.busqueda().toLowerCase();
    if (!q) return this.devoluciones();
    return this.devoluciones().filter(d =>
      d.venta?.folio?.toLowerCase().includes(q) ||
      d.motivo?.toLowerCase().includes(q) ||
      d.tipo?.toLowerCase().includes(q)
    );
  });

  paginaActual = signal(1);
  tamanoPagina = signal(10);
  
  totalPaginas = computed(() => Math.ceil(this.devolucionesFiltradas().length / this.tamanoPagina()) || 1);

  devolucionesPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    const fin = inicio + this.tamanoPagina();
    return this.devolucionesFiltradas().slice(inicio, fin);
  });

  get headers() {
    const s = this.auth.sesion();
    const h: any = {};
    if (s?.idSucursal) h['x-sucursal-id'] = String(s.idSucursal);
    if (s?.idUsuario) h['x-usuario-id'] = String(s.idUsuario);
    return h;
  }

  constructor(private http: HttpClient, private auth: AuthService, public exportService: ExportService) {}

  ngOnInit() { this.cargarDevoluciones(); }

  cargarDevoluciones() {
    this.cargando.set(true);
    this.http.get<any[]>(`${this.API}/devoluciones`, { headers: this.headers }).subscribe({
      next: (data) => { this.devoluciones.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }

  totalDevuelto() { return this.devoluciones().reduce((s, d) => s + Number(d.montoDevuelto), 0); }

  verDetalles(d: any) {
    this.devolucionSeleccionada.set(d);
  }

  cerrarDetalles() {
    this.devolucionSeleccionada.set(null);
  }

  exportarExcel() {
    const data = this.devolucionesFiltradas().map((d: any) => ({
      'ID Devolución': d.idDevolucion,
      'Fecha': new Date(d.fechaDevolucion).toLocaleString(),
      'Venta/Ticket': d.venta?.folio || d.venta?.idVenta || 'N/A',
      'Monto Devuelto': d.montoDevuelto,
      'Motivo': d.motivo || 'N/A',
      'Cajero': d.usuario?.nombreUsuario || 'N/A',
      'Sucursal': d.sucursal?.nombre || 'N/A'
    }));
    this.exportService.exportToExcel(data, 'Reporte_Devoluciones');
  }

  exportarPDF() {
    const headers = ['ID', 'Fecha', 'Ticket', 'Monto', 'Motivo', 'Cajero'];
    const data = this.devolucionesFiltradas().map((d: any) => [
      d.idDevolucion.toString(),
      new Date(d.fechaDevolucion).toLocaleString(),
      d.venta?.folio || d.venta?.idVenta?.toString() || 'N/A',
      `$${d.montoDevuelto}`,
      d.motivo || 'N/A',
      d.usuario?.nombreUsuario || 'N/A'
    ]);
    this.exportService.exportToPdf(headers, data, 'Reporte de Devoluciones', 'Reporte_Devoluciones', 'l');
  }
}
