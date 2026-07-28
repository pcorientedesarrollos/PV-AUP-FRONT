import { environment } from '../../../environments/environment';
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './compras.component.html'
})
export class ComprasComponent implements OnInit {
  compras = signal<any[]>([]);
  busqueda = signal('');
  compraDetalle = signal<any | null>(null);
  cargandoDetalle = signal(false);

  vistaActual = signal<'facturas' | 'conceptos'>('facturas');

  comprasFiltradas = computed(() => {
    const term = this.busqueda().toLowerCase().trim();
    if (!term) return this.compras();
    return this.compras().filter(c =>
      (c.folio || '').toLowerCase().includes(term) ||
      (c.proveedor?.nombre || '').toLowerCase().includes(term) ||
      (c.folioFacturaProveedor || '').toLowerCase().includes(term) ||
      (c.detalles || []).some((d: any) =>
        (d.producto?.nombre || '').toLowerCase().includes(term) ||
        (d.producto?.codigoBarras || '').toLowerCase().includes(term)
      )
    );
  });

  conceptosFiltrados = computed(() => {
    const term = this.busqueda().toLowerCase().trim();
    let todosLosConceptos: any[] = [];
    this.compras().forEach(compra => {
      (compra.detalles || []).forEach((det: any) => {
        todosLosConceptos.push({
          ...det,
          compraFecha: compra.fechaCompra,
          compraFolio: compra.folio,
          compraProveedor: compra.proveedor,
          compraFolioFactura: compra.folioFacturaProveedor
        });
      });
    });

    if (!term) return todosLosConceptos;

    return todosLosConceptos.filter(c =>
      (c.compraFolio || '').toLowerCase().includes(term) ||
      (c.compraProveedor?.nombre || '').toLowerCase().includes(term) ||
      (c.compraFolioFactura || '').toLowerCase().includes(term) ||
      (c.producto?.nombre || '').toLowerCase().includes(term) ||
      (c.producto?.codigoBarras || '').toLowerCase().includes(term) ||
      (c.compraProveedor?.rfc || '').toLowerCase().includes(term)
    );
  });

  totalImporteConceptos = computed(() => {
    return this.conceptosFiltrados().reduce((sum, c) => sum + (Number(c.cantidad) * Number(c.precioCosto)), 0);
  });

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.cargarCompras();
  }

  cargarCompras() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/compras`).subscribe({
      next: (data) => this.compras.set(data),
      error: (err) => console.error('Error al cargar compras', err)
    });
  }

  irANuevaCompra() {
    this.router.navigate(['/compras/nueva']);
  }

  verDetalle(compra: any) {
    // Si ya está seleccionada, cierra el panel
    if (this.compraDetalle()?.idCompra === compra.idCompra) {
      this.compraDetalle.set(null);
      return;
    }
    this.cargandoDetalle.set(true);
    this.http.get<any>(`${environment.apiUrl}/pos/compras/${compra.idCompra}`).subscribe({
      next: (data) => {
        this.compraDetalle.set(data);
        this.cargandoDetalle.set(false);
      },
      error: (err) => {
        console.error('Error al cargar detalle', err);
        this.cargandoDetalle.set(false);
      }
    });
  }

  cerrarDetalle() {
    this.compraDetalle.set(null);
  }

  get totalItems(): number {
    return (this.compraDetalle()?.detalles || []).reduce((s: number, d: any) => s + Number(d.cantidad || 0), 0);
  }
}
