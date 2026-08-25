import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-produccion',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './produccion.component.html',
})
export class ProduccionComponent implements OnInit {
  activeTab = signal<'fraccionar' | 'producir'>('fraccionar');
  productos = signal<any[]>([]);
  cargando = signal(false);
  procesando = signal(false);

  // Fraccionar
  idProductoOrigenF = signal<number | null>(null);
  cantidadOrigenF = signal<number>(1);
  
  recetaPorDefectoF = signal<any[]>([]);
  unidadesFraccionamiento = signal<{
    indice: number,
    salidas: { idProducto: number | null, cantidad: number }[]
  }[]>([
    { indice: 1, salidas: [{ idProducto: null, cantidad: 1 }] }
  ]);
  
  productosOrigenFraccionar = computed(() => {
    return this.productos().filter(p => p.tipoArticulo === 'Comod�n' || p.tipoArticulo === 'Materia Prima');
  });

  // Producir
  idProductoTerminadoP = signal<number | null>(null);
  cantidadProducirP = signal<number>(1);
  ingredientesP = signal<any[]>([]);
  
  productosTerminados = computed(() => {
    return this.productos().filter(p => p.tipoArticulo === 'Terminado');
  });

  productoSeleccionadoP = computed(() => {
    const id = this.idProductoTerminadoP();
    if (!id) return null;
    return this.productos().find(p => p.idProducto === id);
  });

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarProductos();
  }

  cargarProductos() {
    this.cargando.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/pos/productos?limit=10000`).subscribe({
      next: (res: any) => { 
        const data = res.data || res || []; 
        this.productos.set(data); 
        this.cargando.set(false); 
      },
      error: (err) => { 
        console.error('Error al cargar productos', err); 
        this.cargando.set(false); 
      }
    });
  }

  // --- Lógica Fraccionar ---
  onProductoOrigenChange() {
    const id = this.idProductoOrigenF();
    if (!id) {
      this.recetaPorDefectoF.set([]);
      this.regenerarUnidades();
      return;
    }

    this.cargando.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/pos/productos/${id}/recetas`).subscribe({
      next: (data) => {
        this.recetaPorDefectoF.set(data || []);
        this.cargando.set(false);
        this.regenerarUnidades();
      },
      error: (err) => {
        console.error('Error al cargar receta', err);
        this.recetaPorDefectoF.set([]);
        this.cargando.set(false);
        this.regenerarUnidades();
      }
    });
  }

  onCantidadOrigenChange() {
    this.regenerarUnidades(true);
  }

  regenerarUnidades(preservarExistentes: boolean = false) {
    const cantidad = this.cantidadOrigenF() || 1;
    const unidades = this.unidadesFraccionamiento();
    const receta = this.recetaPorDefectoF();
    const plantilla = receta.length > 0 
      ? receta.map(r => ({ idProducto: r.productoHijo?.idProducto, cantidad: r.cantidad }))
      : [{ idProducto: null, cantidad: 1 }];

    const nuevasUnidades = [];
    for (let i = 1; i <= cantidad; i++) {
      if (preservarExistentes && unidades[i - 1]) {
        nuevasUnidades.push(unidades[i - 1]);
      } else {
        // Clonar plantilla para nueva unidad
        nuevasUnidades.push({
          indice: i,
          salidas: plantilla.map(p => ({ ...p }))
        });
      }
    }
    this.unidadesFraccionamiento.set(nuevasUnidades);
  }

  agregarSalidaF(unidadIndex: number) {
    this.unidadesFraccionamiento.update(list => {
      const newList = [...list];
      newList[unidadIndex].salidas.push({ idProducto: null, cantidad: 1 });
      return newList;
    });
  }

  eliminarSalidaF(unidadIndex: number, salidaIndex: number) {
    this.unidadesFraccionamiento.update(list => {
      const newList = [...list];
      newList[unidadIndex].salidas = newList[unidadIndex].salidas.filter((_, i) => i !== salidaIndex);
      return newList;
    });
  }

  ejecutarFraccionamiento() {
    const idOrigen = this.idProductoOrigenF();
    const cantidadOrigen = this.cantidadOrigenF();
    
    // Aplanar y sumarizar salidas
    const salidasMap = new Map<number, number>();
    this.unidadesFraccionamiento().forEach(unidad => {
      unidad.salidas.forEach(salida => {
        if (salida.idProducto && salida.cantidad > 0) {
          const qty = salidasMap.get(salida.idProducto) || 0;
          salidasMap.set(salida.idProducto, qty + salida.cantidad);
        }
      });
    });

    const salidasFlat = Array.from(salidasMap.entries()).map(([idProducto, cantidad]) => ({ idProducto, cantidad }));
    
    if (!idOrigen) return alert('Selecciona un producto de origen.');
    if (!cantidadOrigen || cantidadOrigen <= 0) return alert('La cantidad a descontar debe ser mayor a 0.');
    if (salidasFlat.length === 0) return alert('Agrega al menos un producto de salida válido.');

    if (!confirm(`¿Estás seguro de ejecutar este fraccionamiento?\nSe sumarán ${salidasFlat.length} productos distintos en total.`)) return;

    this.procesando.set(true);
    const body = {
      idProductoPadre: idOrigen,
      cantidad: cantidadOrigen,
      productosResultantes: salidasFlat
    };

    this.http.post(`${environment.apiUrl}/pos/inventario/fraccionar`, body).subscribe({
      next: () => {
        alert('Fraccionamiento completado con éxito.');
        this.procesando.set(false);
        this.idProductoOrigenF.set(null);
        this.cantidadOrigenF.set(1);
        this.recetaPorDefectoF.set([]);
        this.regenerarUnidades();
        this.cargarProductos(); // Recargar inventario
      },
      error: (err) => {
        console.error('Error al fraccionar', err);
        alert(err.error?.message || 'Error al ejecutar fraccionamiento.');
        this.procesando.set(false);
      }
    });
  }

  // --- Lógica Producir ---
  onProductoProducirChange() {
    const id = this.idProductoTerminadoP();
    if (!id) {
      this.ingredientesP.set([]);
      return;
    }
    
    this.cargando.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/pos/productos/${id}/recetas`).subscribe({
      next: (data) => {
        this.ingredientesP.set(data || []);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al cargar receta', err);
        this.ingredientesP.set([]);
        this.cargando.set(false);
      }
    });
  }

  ejecutarProduccion() {
    const idProd = this.idProductoTerminadoP();
    const cant = this.cantidadProducirP();

    if (!idProd || cant <= 0) return alert('Selecciona un producto y cantidad válidos.');
    
    if (this.ingredientesP().length === 0) {
      if (!confirm('Este producto no tiene ingredientes (receta). ¿Producir de todas formas?')) return;
    } else {
      if (!confirm(`¿Producir ${cant} unidades? Se descontarán los ingredientes del inventario.`)) return;
    }

    this.procesando.set(true);
    const body = {
      idProductoTerminado: idProd,
      cantidadProducir: cant
    };

    this.http.post(`${environment.apiUrl}/pos/inventario/producir`, body).subscribe({
      next: () => {
        alert('Producción completada con éxito.');
        this.procesando.set(false);
        this.idProductoTerminadoP.set(null);
        this.cantidadProducirP.set(1);
        this.ingredientesP.set([]);
        this.cargarProductos(); // Recargar inventario
      },
      error: (err) => {
        console.error('Error al producir', err);
        alert(err.error?.message || 'Error al ejecutar producción.');
        this.procesando.set(false);
      }
    });
  }
}
