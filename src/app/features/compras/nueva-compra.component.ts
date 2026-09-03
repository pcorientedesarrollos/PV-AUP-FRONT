import { environment } from '../../../environments/environment';
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

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
  guardando = signal(false);
  importandoXml = signal(false);
  importandoPdf = signal(false);
  importando = computed(() => this.importandoXml() || this.importandoPdf());

  // XML Modals State
  mostrarModalNuevoProveedorXml = signal(false);
  proveedorXmlPendiente: any = null;
  resolveProveedorXml: ((value: boolean) => void) | null = null;

  mostrarModalNuevosProductosXml = signal(false);
  productosXmlPendientes: any[] = [];
  resolveProductosXml: ((value: boolean) => void) | null = null;
  
  // Facturas a adjuntar
  archivoXml: File | null = null;
  archivoPdf: File | null = null;

  constructor(
    private http: HttpClient, 
    private router: Router, 
    private route: ActivatedRoute,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.cargarProveedores();
    this.cargarCatalogo();
    this.route.queryParams.subscribe(params => {
      if (params['proveedorId']) {
        this.idProveedor.set(Number(params['proveedorId']));
      }
    });
  }

  cargarProveedores() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/proveedores`).subscribe(data => this.proveedores.set(data));
  }

  cargarCatalogo() {
    this.http.get<any>(`${environment.apiUrl}/pos/productos?limit=10000`).subscribe(res => {
      this.catalogoProductos.set(res.data || res);
    });
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

  importarXml(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.archivoXml = file;
    this.importandoXml.set(true);
    const formData = new FormData();
    formData.append('xml', file);
    const idSucursal = this.auth.sesion()?.idSucursal;
    
    this.http.post<any>(`${environment.apiUrl}/pos/inventario/importar-xml`, formData, {
      headers: { 'x-sucursal-id': idSucursal?.toString() || '' }
    }).subscribe({
      next: async (res) => {
        this.importandoXml.set(false);
        await this.procesarFacturaResponse(res);
      },
      error: (err) => {
        this.importandoXml.set(false);
        this.toast.show('Error al leer el XML: ' + (err.error?.message || err.message), 'error');
      }
    });
  }

  importarPdf(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.archivoPdf = file;
    this.importandoPdf.set(true);
    const formData = new FormData();
    formData.append('pdf', file);
    const idSucursal = this.auth.sesion()?.idSucursal;
    
    this.http.post<any>(`${environment.apiUrl}/pos/inventario/importar-pdf`, formData, {
      headers: { 'x-sucursal-id': idSucursal?.toString() || '' }
    }).subscribe({
      next: async (res) => {
        this.importandoPdf.set(false);
        await this.procesarFacturaResponse(res);
      },
      error: (err) => {
        this.importandoPdf.set(false);
        this.toast.show('Error al leer el PDF: ' + (err.error?.message || err.message), 'error');
      }
    });
  }

  async procesarFacturaResponse(res: any) {
    // Auto-asignar Folio
    if (res.folio || res.serie) {
      const folioStr = `${res.serie || ''}${res.folio || ''}`.trim();
      this.folioFactura.set(folioStr);
    }

    // 1. Tratar de buscar proveedor por RFC
    let provId = null;
    if (res.emisor?.rfc) {
      const prov = this.proveedores().find(p => p.rfc === res.emisor.rfc);
      if (prov) {
        provId = prov.idProveedor;
      } else {
        // Proveedor no encontrado -> Mostrar Modal
        const agregarProv = await new Promise<boolean>(resolve => {
          this.proveedorXmlPendiente = res.emisor;
          this.resolveProveedorXml = resolve;
          this.mostrarModalNuevoProveedorXml.set(true);
        });
        this.mostrarModalNuevoProveedorXml.set(false);

        if (agregarProv) {
          // Llamada a la API para crear proveedor
          try {
            const nuevoProv = await this.http.post<any>(`${environment.apiUrl}/pos/proveedores`, {
              nombre: res.emisor.nombre || res.emisor.rfc || 'Proveedor Desconocido',
              rfc: res.emisor.rfc,
            }).toPromise();
            // Actualizar lista y seleccionar
            this.proveedores.set([...this.proveedores(), nuevoProv]);
            provId = nuevoProv.idProveedor;
          } catch (e) {
            this.toast.show('Error al crear el proveedor.', 'error');
          }
        }
      }
    }
    if (provId) this.idProveedor.set(provId);
    
    // 2. Procesar Conceptos (Productos)
    const nuevosItems = [...this.carrito()];
    const noEncontrados: any[] = [];
    
    for (const c of (res.conceptos || [])) {
      if (c.productoEncontrado) {
        const index = nuevosItems.findIndex(i => i.idProducto === c.productoEncontrado.idProducto && i.precioCosto === (c.costoUnitario || c.productoEncontrado.precioUnitario || 0));
        if (index >= 0) {
          nuevosItems[index].cantidad += c.cantidad;
        } else {
          nuevosItems.push({
            idProducto: c.productoEncontrado.idProducto,
            nombre: c.productoEncontrado.nombre,
            cantidad: c.cantidad,
            precioCosto: c.costoUnitario || c.productoEncontrado.precioUnitario || 0,
            actualizarCosto: false
          });
        }
      } else {
        noEncontrados.push(c);
      }
    }
    
    // 3. Si hay productos no encontrados, mostrar modal
    if (noEncontrados.length > 0) {
      const agregarProds = await new Promise<boolean>(resolve => {
        this.productosXmlPendientes = noEncontrados;
        this.resolveProductosXml = resolve;
        this.mostrarModalNuevosProductosXml.set(true);
      });
      this.mostrarModalNuevosProductosXml.set(false);

      if (agregarProds) {
        for (const p of noEncontrados) {
          try {
            const nuevoProd = await this.http.post<any>(`${environment.apiUrl}/pos/productos`, {
              nombre: p.conceptoXml,
              precioUnitario: p.costoUnitario, // Por ahora el costo es el precio para evitar nulos
              codigoBarras: p.noIdentificacion,
              idCategoria: 1, // Categoría por defecto "General" si existe
            }).toPromise();
            
            nuevosItems.push({
              idProducto: nuevoProd.idProducto,
              nombre: nuevoProd.nombre,
              cantidad: p.cantidad,
              precioCosto: p.costoUnitario,
              actualizarCosto: false
            });
          } catch (e) {
            console.error('Error creando producto', p, e);
          }
        }
        // Actualizar catálogo local
        this.cargarCatalogo();
      }
    }
    
    this.carrito.set(nuevosItems);
  }

  finalizarCompra() {
    if (!this.idProveedor()) {
      this.toast.show('Debes seleccionar un proveedor.', 'warning');
      return;
    }
    if (this.carrito().length === 0) {
      this.toast.show('El carrito está vacío.', 'warning');
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

    this.http.post<any>(`${environment.apiUrl}/pos/compras`, payload).subscribe({
      next: async (res) => {
        const idCompra = res?.compra?.idCompra || res?.idCompra;
        
        if (idCompra && (this.archivoPdf || this.archivoXml)) {
          const fd = new FormData();
          if (this.archivoPdf) fd.append('pdf', this.archivoPdf);
          if (this.archivoXml) fd.append('xml', this.archivoXml);
          
          try {
            await this.http.patch(`${environment.apiUrl}/pos/compras/${idCompra}/factura`, fd).toPromise();
          } catch (e) {
            console.error('Error al subir facturas', e);
            this.toast.show('Compra guardada, pero hubo un error al subir la factura PDF/XML.', 'warning');
          }
        }
        
        this.guardando.set(false);
        this.toast.show('¡Compra registrada exitosamente! El inventario ha sido actualizado.', 'success');
        this.router.navigate(['/compras']);
      },
      error: (err) => {
        this.guardando.set(false);
        console.error(err);
        this.toast.show('Ocurrió un error al registrar la compra.', 'error');
      }
    });
  }

  cancelar() {
    if (confirm('¿Estás seguro de cancelar esta compra? Se perderán los datos.')) {
      this.router.navigate(['/compras']);
    }
  }
}

