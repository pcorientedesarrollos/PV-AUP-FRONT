import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-traspasos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './traspasos.component.html',
})
export class TraspasosComponent implements OnInit {
  vistaActiva = signal<'nuevo' | 'historial'>('nuevo');
  
  // Datos
  sucursales = signal<any[]>([]);
  traspasos = signal<any[]>([]);
  productosDisponibles = signal<any[]>([]);
  
  // Parámetros de formulario
  idSucursalOrigen = signal<number | null>(null);
  idSucursalDestino = signal<number | null>(null);
  observaciones = signal<string>('');
  
  // Buscador de productos
  busquedaProducto = signal('');
  productosFiltrados = computed(() => {
    const term = this.busquedaProducto().toLowerCase().trim();
    if (!term) return [];
    return this.productosDisponibles().filter(p => 
      p.nombre.toLowerCase().includes(term) || 
      (p.codigoBarras && p.codigoBarras.toLowerCase().includes(term))
    );
  });
  
  carrito = signal<{ producto: any, cantidad: number }[]>([]);
  
  cargando = signal(false);
  guardando = signal(false);

  constructor(private http: HttpClient, public auth: AuthService) {}

  ngOnInit() {
    this.cargarSucursales();
    this.cargarHistorial();
  }

  onOrigenChange(origen: number | null) {
    if (origen) {
      this.cargarProductosOrigen(origen);
      this.carrito.set([]); // Resetear carrito al cambiar origen
    } else {
      this.productosDisponibles.set([]);
      this.carrito.set([]);
    }
  }

  cargarSucursales() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/sucursales`).subscribe({
      next: (data) => this.sucursales.set(data),
      error: (err) => console.error('Error al cargar sucursales', err)
    });
  }

  cargarProductosOrigen(idSucursal: number) {
    this.cargando.set(true);
    // Asumiendo que el endpoint de productos acepta idSucursal para filtrar el inventario específico
    this.http.get<any[]>(`${environment.apiUrl}/pos/productos?limit=10000&idSucursal=${idSucursal}`).subscribe({
      next: (data) => {
        this.productosDisponibles.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar productos', err);
        this.cargando.set(false);
      }
    });
  }

  cargarHistorial() {
    const empresaId = this.auth.sesion()?.empresa?.idEmpresa || 1;
    const headers = new HttpHeaders().set('x-empresa-id', empresaId.toString());
    
    this.http.get<any[]>(`${environment.apiUrl}/pos/inventario/traspasos`, { headers }).subscribe({
      next: (data) => this.traspasos.set(data),
      error: (err) => console.error('Error al cargar historial de traspasos', err)
    });
  }

  agregarAlCarrito(producto: any) {
    const existe = this.carrito().find(i => i.producto.idProducto === producto.idProducto);
    if (existe) {
      alert('El producto ya está en la lista del traspaso.');
      return;
    }
    this.carrito.update(c => [...c, { producto, cantidad: 1 }]);
    this.busquedaProducto.set('');
  }

  removerDelCarrito(idProducto: number) {
    this.carrito.update(c => c.filter(i => i.producto.idProducto !== idProducto));
  }

  confirmarTraspaso() {
    if (!this.idSucursalOrigen() || !this.idSucursalDestino()) {
      alert('Debes seleccionar las sucursales de origen y destino.');
      return;
    }
    if (this.idSucursalOrigen() === this.idSucursalDestino()) {
      alert('La sucursal de origen y destino no pueden ser la misma.');
      return;
    }
    if (this.carrito().length === 0) {
      alert('Agrega al menos un producto al traspaso.');
      return;
    }
    
    for (const item of this.carrito()) {
      if (item.cantidad <= 0) {
        alert(`La cantidad para ${item.producto.nombre} debe ser mayor a 0.`);
        return;
      }
      if (item.cantidad > item.producto.stockActual) {
         alert(`Stock insuficiente para ${item.producto.nombre}. Stock actual: ${item.producto.stockActual}`);
         return;
      }
    }

    const payload = {
      idSucursalOrigen: this.idSucursalOrigen(),
      idSucursalDestino: this.idSucursalDestino(),
      observaciones: this.observaciones(),
      productos: this.carrito().map(i => ({
        idProducto: i.producto.idProducto,
        cantidad: i.cantidad
      }))
    };

    this.guardando.set(true);
    this.http.post(`${environment.apiUrl}/pos/inventario/traspasos`, payload).subscribe({
      next: () => {
        alert('Traspaso realizado con éxito.');
        this.guardando.set(false);
        this.carrito.set([]);
        this.observaciones.set('');
        this.cargarHistorial();
        this.vistaActiva.set('historial');
      },
      error: (err) => {
        console.error('Error en el traspaso', err);
        alert('Hubo un error al realizar el traspaso.');
        this.guardando.set(false);
      }
    });
  }

  descargarReporte(idTraspaso: number) {
    this.http.get(`${environment.apiUrl}/pos/inventario/traspasos/${idTraspaso}/reporte`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Traspaso_${idTraspaso}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error al descargar reporte', err);
        alert('No se pudo descargar el reporte.');
      }
    });
  }
}
