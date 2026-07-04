import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './compras.component.html'
})
export class ComprasComponent implements OnInit {
  compras = signal<any[]>([]);

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.cargarCompras();
  }

  cargarCompras() {
    this.http.get<any[]>('http://localhost:3000/pos/compras').subscribe({
      next: (data) => this.compras.set(data),
      error: (err) => console.error('Error al cargar compras', err)
    });
  }

  irANuevaCompra() {
    this.router.navigate(['/compras/nueva']);
  }
}
