import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-devoluciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './devoluciones.component.html',
})
export class DevolucionesComponent implements OnInit {
  readonly API = 'http://localhost:3000/pos';

  devoluciones = signal<any[]>([]);
  cargando = signal(true);
  busqueda = signal('');

  devolucionesFiltradas = computed(() => {
    const q = this.busqueda().toLowerCase();
    if (!q) return this.devoluciones();
    return this.devoluciones().filter(d =>
      d.venta?.folio?.toLowerCase().includes(q) ||
      d.motivo?.toLowerCase().includes(q) ||
      d.tipo?.toLowerCase().includes(q)
    );
  });

  get headers() {
    const s = this.auth.sesion();
    const h: any = {};
    if (s?.idSucursal) h['x-sucursal-id'] = String(s.idSucursal);
    if (s?.idUsuario) h['x-usuario-id'] = String(s.idUsuario);
    return h;
  }

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() { this.cargarDevoluciones(); }

  cargarDevoluciones() {
    this.cargando.set(true);
    this.http.get<any[]>(`${this.API}/devoluciones`, { headers: this.headers }).subscribe({
      next: (data) => { this.devoluciones.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false)
    });
  }

  totalDevuelto() { return this.devoluciones().reduce((s, d) => s + Number(d.montoDevuelto), 0); }
}
