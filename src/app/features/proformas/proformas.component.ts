import { environment } from '../../../environments/environment';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-proformas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proformas.component.html',
  styleUrl: './proformas.component.css',
})
export class ProformasComponent implements OnInit {
  private http = inject(HttpClient);

  proformas = signal<any[]>([]);
  idSucursalSesion = Number(localStorage.getItem('sucursal_id')) || 1;

  // Modal de nueva proforma
  mostrarModal = signal(false);
  folioVenta = signal('');
  clienteNombre = signal('');
  generando = signal(false);

  ngOnInit() {
    this.cargarProformas();
  }

  cargarProformas() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/proformas`, {
      headers: { 'x-sucursal-id': this.idSucursalSesion.toString() }
    }).subscribe({
      next: (data) => this.proformas.set(data),
      error: () => alert('Error cargando proformas')
    });
  }

  abrirModal() {
    this.folioVenta.set('');
    this.clienteNombre.set('');
    this.mostrarModal.set(true);
  }

  cerrarModal() {
    this.mostrarModal.set(false);
  }

  generarProforma() {
    if (!this.folioVenta()) {
      alert('Ingresa el folio de la venta');
      return;
    }

    // El folio puede venir como SRV-5, VTA-5 o solo 5
    const match = this.folioVenta().match(/\d+$/);
    if (!match) {
      alert('Formato de folio inválido');
      return;
    }
    const idVenta = Number(match[0]);

    this.generando.set(true);
    this.http.post<any>(`${environment.apiUrl}/pos/proforma`, {
      idVenta: idVenta,
      clienteNombre: this.clienteNombre()
    }).subscribe({
      next: (res) => {
        alert('Proforma generada exitosamente');
        this.generando.set(false);
        this.cerrarModal();
        this.cargarProformas();
        if (res.proforma?.urlPdf) {
          window.open(res.proforma.urlPdf, '_blank');
        }
      },
      error: (err) => {
        this.generando.set(false);
        alert(err.error?.message || 'Error al generar proforma');
      }
    });
  }

  descargarPdf(url: string) {
    if (url) window.open(url, '_blank');
  }
}
