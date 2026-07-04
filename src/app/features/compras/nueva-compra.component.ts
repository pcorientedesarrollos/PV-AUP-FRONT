import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-nueva-compra',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nueva-compra.component.html'
})
export class NuevaCompraComponent implements OnInit {
  proveedores = signal<any[]>([]);
  catalogoProductos = signal<any[]>([]);
  
  // Compra State
  idProveedor = signal<number | null>(null);
  folioFactura = signal<string>('');
  notas = signal<string>('');
  
  // Carrito
  carrito = signal<any[]>([]);
  busquedaProducto = signal<string>('');

  // UI State
  guardando = signal<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.cargarProveedores();
    this.cargarCatalogo();
  }

  cargarProveedores() {
    this.http.get<any[]>('http://localhost:3000/pos/proveedores').subscribe(data => this.proveedores.set(data));
  }

  cargarCatalogo() {
    this.http.get<any[]>('http://localhost:3000/pos/productos').subscribe(data => this.catalogoProductos.set(data));
  }

  productosFiltrados = computed(() => {
    const term = this.busquedaProducto().toLowerCase().trim();
    if (!term) return [];
    return this.catalogoProductos().filter(p => 
      (p.nombre || '').toLowerCase().includes(term) || 
      (p.codigoBarras || '').toLowerCase().includes(term)
    );
  });

  agregarAlCarrito(producto: any) {
    const current = this.carrito();
    const existe = current.find(item => item.idProducto === producto.idProducto);
    
    if (existe) {
      existe.cantidad++;
      this.carrito.set([...current]);
    } else {
      this.carrito.set([...current, {
        idProducto: producto.idProducto,
        nombre: producto.nombre,
        cantidad: 1,
        precioCosto: producto.precioUnitario || 0, // precio unitario = costo
        actualizarCosto: false
      }]);
    }
    this.busquedaProducto.set('');
  }

  removerDelCarrito(idProducto: number) {
    this.carrito.set(this.carrito().filter(i => i.idProducto !== idProducto));
  }

  totalCompra = computed(() => {
    return this.carrito().reduce((sum, item) => sum + (item.cantidad * item.precioCosto), 0);
  });

  finalizarCompra() {
    if (!this.idProveedor()) {
      alert('Debes seleccionar un proveedor.');
      return;
    }
    if (this.carrito().length === 0) {
      alert('El carrito está vacío.');
      return;
    }

    this.guardando.set(true);
    const payload = {
      idProveedor: this.idProveedor(),
      folioFacturaProveedor: this.folioFactura(),
      notas: this.notas(),
      total: this.totalCompra(),
      detalles: this.carrito().map(item => ({
        idProducto: item.idProducto,
        cantidad: item.cantidad,
        precioCosto: item.precioCosto,
        actualizarCosto: item.actualizarCosto
      }))
    };

    this.http.post('http://localhost:3000/pos/compras', payload).subscribe({
      next: () => {
        this.guardando.set(false);
        alert('¡Compra registrada exitosamente! El inventario ha sido actualizado.');
        this.router.navigate(['/compras']);
      },
      error: (err) => {
        this.guardando.set(false);
        console.error(err);
        alert('Ocurrió un error al registrar la compra.');
      }
    });
  }

  cancelar() {
    if (confirm('¿Estás seguro de cancelar esta compra? Se perderán los datos.')) {
      this.router.navigate(['/compras']);
    }
  }
}
