import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { of, tap } from 'rxjs';
import { SyncService } from './sync.service';
import { ConfigService } from './config.service';
import { environment } from '../../../environments/environment';
import {
  Producto,
  Cliente,
  ItemCarrito,
  CheckoutPayload,
  AltaRapidaPayload,
  AbrirTurnoPayload,
  VentaPausada
} from '../interfaces';

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly API = environment.apiUrl;
  private configService = inject(ConfigService);

  // ─── Estado del carrito con signals ──────────────────────────────────────────
  private _carrito = signal<ItemCarrito[]>([]);
  readonly carrito = this._carrito.asReadonly();

  readonly totalItems = computed(() =>
    this._carrito().reduce((acc, item) => acc + item.cantidad, 0)
  );

  readonly totalDescuentos = computed(() => 
    this._carrito().reduce((acc, item) => acc + (Number(item.descuento) || 0), 0)
  );

  readonly subtotal = computed(() =>
    this._carrito().reduce((acc, item) => {
      const qty = Number(item.cantidad) || 0;
      const price = this.getPrecioActivo(item.producto, qty);
      return acc + (price * qty);
    }, 0)
  );

  readonly totalIva = computed(() => {
    const ivaDefecto = this.configService.config().ivaPorDefecto || 0; 
    return this._carrito().reduce((acc, item) => {
      const qty = Number(item.cantidad) || 0;
      const price = this.getPrecioActivo(item.producto, qty);
      const discount = Number(item.descuento) || 0;
      const sub = (price * qty) - discount;
      
      let iva = 0;
      if (item.producto.aplicaIva !== false) {
        iva = item.producto.iva !== undefined ? Number(item.producto.iva) : ivaDefecto;
      }
      
      const tasa = iva < 0 ? 0 : iva / 100;
      return acc + (sub * tasa);
    }, 0);
  });

  readonly totalPagar = computed(() => this.subtotal() - this.totalDescuentos() + this.totalIva());

  // Cliente seleccionado
  private _clienteSeleccionado = signal<Cliente | null>(null);
  readonly clienteSeleccionado = this._clienteSeleccionado.asReadonly();

  private sync = inject(SyncService);

  constructor(private http: HttpClient) {}

  // ─── Catálogo ─────────────────────────────────────────────────────────────────
  private _productos = signal<Producto[]>([]);
  readonly productos = this._productos.asReadonly();

  private _stockActual = signal<Record<number, number>>({});
  readonly stockActual = this._stockActual.asReadonly();

  readonly cantidadesEnCarrito = computed(() => {
    const mapa: Record<number, number> = {};
    this._carrito().forEach(item => {
      mapa[item.producto.idProducto] = (mapa[item.producto.idProducto] || 0) + item.cantidad;
    });
    return mapa;
  });

  stockRestanteVisual(idProducto: number): number {
    const bd = this._stockActual()[idProducto] || 0;
    const carrito = this.cantidadesEnCarrito()[idProducto] || 0;
    return bd - carrito;
  }


  getSucursales() {
    return this.http.get<any[]>(`${this.API}/pos/sucursales`);
  }

  crearSucursal(payload: any) {
    return this.http.post<any>(`${this.API}/pos/sucursales`, payload);
  }

  actualizarSucursal(id: number, payload: any) {
    return this.http.put<any>(`${this.API}/pos/sucursales/${id}`, payload);
  }

  // ─── EMPRESAS ───────────────────────────────────────────────────
  getEmpresas() {
    return this.http.get<any[]>(`${this.API}/pos/empresas`);
  }

  crearEmpresa(payload: any) {
    return this.http.post<any>(`${this.API}/pos/empresas`, payload);
  }

  actualizarEmpresa(id: number, payload: any) {
    return this.http.put<any>(`${this.API}/pos/empresas/${id}`, payload);
  }

  // ─── CATEGORIAS ─────────────────────────────────────────────────
  getCategorias() {
    return this.http.get<any[]>(`${this.API}/pos/categorias`);
  }

  crearCategoria(payload: any) {
    return this.http.post<any>(`${this.API}/pos/categorias`, payload);
  }

  actualizarCategoria(id: number, payload: any) {
    return this.http.put<any>(`${this.API}/pos/categorias/${id}`, payload);
  }

  getUsuarios(idSucursal?: number) {
    // El interceptor ya envía x-sucursal-id, pero si se pasa explícitamente lo incluimos también
    const headers: any = {};
    if (idSucursal) headers['x-sucursal-id'] = String(idSucursal);
    return this.http.get<any[]>(`${this.API}/pos/usuarios`, { headers });
  }

  getUsuariosGlobal() {
    return this.http.get<any[]>(`${this.API}/pos/usuarios/global`);
  }

  crearUsuario(payload: any) {
    return this.http.post<any>(`${this.API}/pos/usuarios`, payload);
  }

  actualizarUsuario(id: number, payload: any) {
    return this.http.patch<any>(`${this.API}/pos/usuarios/${id}`, payload);
  }

  getProductos(page: number = 1, limit: number = 20, search: string = '') {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('search', search);

    return this.http.get<any>(`${this.API}/pos/productos`, { params }).pipe(
      tap((res: any) => {
        // res contains { data, total, page, limit, totalPages }
        this._productos.set(res.data);
        const mapa: Record<number, number> = { ...this._stockActual() };
        res.data.forEach((item: any) => mapa[item.idProducto] = item.stockActual || 0);
        this._stockActual.set(mapa);
      })
    );
  }

  buscarProductoPorCodigo(codigo: string) {
    const params = new HttpParams().set('codigo', codigo);
    return this.http.get<any>(`${this.API}/pos/productos/buscar`, { params }).pipe(
      tap(prod => {
        if (prod) {
          const mapa = { ...this._stockActual() };
          mapa[prod.idProducto] = prod.stockActual || 0;
          this._stockActual.set(mapa);
        }
      })
    );
  }

  // ─── Clientes ─────────────────────────────────────────────────────────────────
  getClientes(page: number = 1, limit: number = 20, search: string = '') {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('search', search);
    return this.http.get<any>(`${this.API}/pos/clientes`, { params });
  }

  altaRapidaCliente(payload: AltaRapidaPayload) {
    return this.http.post<Cliente>(`${this.API}/pos/clientes/alta-rapida`, payload);
  }


  private getDescuentoTotalItem(producto: any, cantidad: number): number {
    if (!producto.aplicaDescuento) return 0;
    const desc = Number(producto.descuento) || 0;
    if (producto.tipoDescuento === 'porcentaje') {
      const precioBase = Number(producto.precioPublico) || Number(producto.precioVenta) || Number(producto.precioUnitario) || 0;
      return ((precioBase * desc) / 100) * cantidad;
    }
    return desc * cantidad;
  }

  private getPrecioActivo(producto: Producto, cantidad: number): number {
    const precioBase = Number(producto.precioPublico) || Number(producto.precioVenta) || Number(producto.precioUnitario) || 0;
    const minimoMayoreo = Number(producto.minimoMayoreo) || 0;
    const precioMayoreo = Number(producto.precioMayoreo) || 0;
    if (minimoMayoreo > 0 && cantidad >= minimoMayoreo && precioMayoreo > 0) {
      return precioMayoreo;
    }
    return precioBase;
  }

  seleccionarCliente(cliente: Cliente | null) {
    this._clienteSeleccionado.set(cliente);
  }

  // ─── Carrito ──────────────────────────────────────────────────────────────────
  agregarAlCarrito(producto: Producto, forzar: boolean = false, silent: boolean = false): boolean {
    const totalEnCarrito = this._carrito()
      .filter(i => i.producto.idProducto === producto.idProducto)
      .reduce((sum, i) => sum + i.cantidad, 0);
    const cantidadAumentada = totalEnCarrito + 1;

    if (!forzar) {
      const stockDisponible = this.stockActual()[producto.idProducto] || 0;
      // Skip prompt if they already accepted it for this product
      const yaAcepto = totalEnCarrito > Math.max(0, stockDisponible);
      if (!yaAcepto) {
        if (stockDisponible <= 0) {
          this.solicitarConfirmacionStock(producto, 'vacio', () => this.agregarAlCarrito(producto, true, silent));
          return false;
        } else if (cantidadAumentada > stockDisponible) {
          this.solicitarConfirmacionStock(producto, 'excedido', () => this.agregarAlCarrito(producto, true, silent));
          return false;
        }
      }
    }

    const price = this.getPrecioActivo(producto, cantidadAumentada);
    this._carrito.update((items) => {
      const idx = items.findIndex((i) => {
          const expectedDesc = this.getDescuentoTotalItem(i.producto, i.cantidad);
          const isCustomDiscount = i.descuento !== expectedDesc;
          return i.producto.idProducto === producto.idProducto && !isCustomDiscount;
        });

        if (idx >= 0) {
          const updated = [...items];
          const qty = updated[idx].cantidad + 1;
          const newPrice = this.getPrecioActivo(producto, qty);
          
          updated[idx] = {
            ...updated[idx],
            producto: producto, // Update product info in case price/discount changed in DB
            cantidad: qty,
            subtotal: qty * newPrice,
            descuento: (this.getDescuentoTotalItem(producto, qty)),
          };
          return updated;
        }
      return [
        ...items,
        { uid: Math.random().toString(36).substr(2, 9), producto, cantidad: 1, subtotal: price, descuento: this.getDescuentoTotalItem(producto, 1) }
      ];
    });
    return true;
  }

  cambiarCantidad(uid: string, delta: number, forzar: boolean = false): boolean {
    const itemEnCarrito = this._carrito().find(i => i.uid === uid);
    if (!itemEnCarrito) return false;
    const nuevaCantidad = itemEnCarrito.cantidad + delta;
    
    if (delta > 0 && !forzar) {
      const stockDisponible = this.stockActual()[itemEnCarrito.producto.idProducto] || 0;
      const totalEnCarrito = this._carrito()
        .filter(i => i.producto.idProducto === itemEnCarrito.producto.idProducto)
        .reduce((sum, i) => sum + i.cantidad, 0);
      const nuevaCantidadTotal = totalEnCarrito + delta;

      if (nuevaCantidadTotal > stockDisponible) {
        // If it was already at 0 or less, maybe show vacio? 
        // But if they are increasing, it's 'excedido' (or 'vacio' if 0)
        this.solicitarConfirmacionStock(itemEnCarrito.producto, stockDisponible <= 0 ? 'vacio' : 'excedido', () => this.cambiarCantidad(uid, delta, true));
        return false;
      }
    }

    this._carrito.update((items) =>
      items
        .map((item) => {
          if (item.uid !== uid) return item;
          const nuevaCantidad = item.cantidad + delta;
          if (nuevaCantidad <= 0) return null;
          const price = this.getPrecioActivo(item.producto, nuevaCantidad);
          const nuevoDescuento = this.getDescuentoTotalItem(item.producto, nuevaCantidad);
          return {
            ...item,
            cantidad: nuevaCantidad,
            subtotal: nuevaCantidad * price,
            descuento: nuevoDescuento,
          };
        })
        .filter((item): item is ItemCarrito => item !== null)
    );
    return true;
  }

  setCantidadExacta(uid: string, cantidad: number) {
    if (cantidad === null || isNaN(cantidad) || cantidad <= 0) {
      this.eliminarDelCarrito(uid);
      return;
    }

    const itemEnCarrito = this._carrito().find(i => i.uid === uid);
    if (!itemEnCarrito) return;

    this._carrito.update((items) =>
      items.map((item) => {
        if (item.uid !== uid) return item;
        const price = this.getPrecioActivo(item.producto, Number(cantidad));
        const nuevoDescuento = this.getDescuentoTotalItem(item.producto, Number(cantidad));
        return {
          ...item,
          cantidad: Number(cantidad),
          subtotal: Number(cantidad) * price,
          descuento: nuevoDescuento,
        };
      })
    );
  }

  toggleIva(uid: string, aplicaIva: boolean) {
    this._carrito.update(items =>
      items.map(i => i.uid === uid ? { ...i, producto: { ...i.producto, aplicaIva } } : i)
    );
  }

  actualizarCantidad(uid: string, cantidad: number) {
    this._carrito.update(items =>
      items.map(i => i.uid === uid ? { ...i, cantidad, subtotal: this.getPrecioActivo(i.producto, cantidad) * cantidad, descuento: (this.getDescuentoTotalItem(i.producto, cantidad)) } : i)
    );
  }

  aplicarDescuentoAItem(uid: string, descuento: number) {
    this._carrito.update(items =>
      items.map(i => {
        if (i.uid === uid) {
          const qty = Number(i.cantidad) || 0;
          const price = Number(i.producto.precioPublico) || Number(i.producto.precioVenta) || Number(i.producto.precioUnitario) || 0;
          const maxDescuento = qty * price;
          const finalDescuento = Math.min(Math.max(0, descuento), maxDescuento);
          return { ...i, descuento: finalDescuento };
        }
        return i;
      })
    );
  }

  eliminarDelCarrito(uid: string) {
    this._carrito.update((items) =>
      items.filter((i) => i.uid !== uid)
    );
  }

  limpiarCarrito() {
    this._carrito.set([]);
    this._clienteSeleccionado.set(null);
  }

  // ─── Ventas Pausadas ──────────────────────────────────────────────────────────
  private _ventasPausadas = signal<VentaPausada[]>([]);
  readonly ventasPausadas = this._ventasPausadas.asReadonly();

  pausarVenta() {
    if (this._carrito().length === 0) return;

    const nuevaPausa: VentaPausada = {
      id: Date.now(),
      timestamp: new Date(),
      cliente: this._clienteSeleccionado(),
      carrito: [...this._carrito()]
    };

    this._ventasPausadas.update(vp => [...vp, nuevaPausa]);
    this.limpiarCarrito();
  }

  recuperarVenta(id: number) {
    const venta = this._ventasPausadas().find(v => v.id === id);
    if (!venta) return;

    // Si hay un carrito actual con productos, no deberíamos sobrescribirlo sin avisar
    // Pero asumiremos que la UI controla esto (limpiar antes o advertir)
    this._carrito.set([...venta.carrito]);
    this._clienteSeleccionado.set(venta.cliente);
    
    // Eliminar de las pausadas
    this.eliminarVentaPausada(id);
  }

  eliminarVentaPausada(id: number) {
    this._ventasPausadas.update(vp => vp.filter(v => v.id !== id));
  }

  // ─── Control de Modal de Stock ────────────────────────────────────────────────
  private _accionPendienteStock: (() => void) | null = null;
  private _productoAdvertenciaStock = signal<{ producto: Producto; tipo: 'vacio' | 'excedido' } | null>(null);
  readonly productoAdvertenciaStock = this._productoAdvertenciaStock.asReadonly();

  solicitarConfirmacionStock(producto: Producto, tipo: 'vacio' | 'excedido', accionConfirmada: () => void) {
    this._accionPendienteStock = accionConfirmada;
    this._productoAdvertenciaStock.set({ producto, tipo });
  }

  confirmarVentaSinStock() {
    if (this._accionPendienteStock) {
      this._accionPendienteStock();
      this._accionPendienteStock = null;
    }
    this._productoAdvertenciaStock.set(null);
  }

  cancelarVentaSinStock() {
    this._accionPendienteStock = null;
    this._productoAdvertenciaStock.set(null);
  }

  cargarDesdeHistorial(idOrFolio: string | number, isEditar: boolean, tipo: 'venta') {
    if (tipo === 'venta') {
      this.http.get<any[]>(`${this.API}/pos/ventas?folio=${idOrFolio}`).subscribe({
        next: (ventas) => {
          const venta = ventas.find((v: any) => v.folio == idOrFolio || v.idCajaChica == idOrFolio);
          if (venta) {
            this.poblarCarritoCon(venta.detalles, venta.cliente);
          }
        }
      });
    }
  }

  poblarCarritoCon(detalles: any[], cliente: any, nombreClienteTemporal?: string) {
    this._carrito.set([]); // Limpiar
    const nuevoCarrito = detalles.map(d => {
      const cantidad = Number(d.cantidad) || 1;
      const precioUnitario = Number(d.precioUnitario) || Number(d.producto?.precioVenta) || 0;
      const importe = cantidad * precioUnitario;
      const utilidad = d.producto ? (precioUnitario - (Number(d.producto?.precioCosto) || 0)) * cantidad : 0;
      
      return {
        uid: Date.now().toString(36) + Math.random().toString(36).substr(2),
        producto: d.producto,
        cantidad: cantidad,
        precioUnitario: precioUnitario,
        importe: importe,
        subtotal: importe,
        utilidad: utilidad,
        descuento: d.descuento || 0
      };
    });
    this._carrito.set(nuevoCarrito);
    if (cliente) {
      this._clienteSeleccionado.set(cliente);
    }
  }

  // ─── Caja ─────────────────────────────────────────────────────────────────────
  getTurnoActivo(idUsuario: number) {
    return this.http.get<any>(`${this.API}/pos/turno-activo/${idUsuario}`);
  }

  abrirTurno(payload: AbrirTurnoPayload) {
    return this.http.post(`${this.API}/pos/abrir-turno`, payload);
  }

  checkout(payload: CheckoutPayload) {
    if (!this.sync.isOnline()) {
      // Guardar localmente
      this.sync.guardarVentaPendiente(payload);
      return of({
        success: true,
        mensaje: 'Venta guardada en modo offline. Se sincronizará automáticamente.',
        offline: true
      });
    }
    return this.http.post(`${this.API}/pos/checkout`, payload);
  }

  getCorteDeCaja(idUsuario: number) {
    return this.http.get<any>(`${this.API}/pos/corte-actual/${idUsuario}`);
  }
  
  cerrarTurno(payload: { idCorte: number, efectivoEscaner: number }) {
    return this.http.post(`${this.API}/pos/corte`, payload);
  }

  // ─── Cotizaciones ─────────────────────────────────────────────────────────────
  getCotizaciones() {
    return this.http.get<any[]>(`${this.API}/pos/cotizaciones`);
  }

  crearCotizacion(payload: any) {
    return this.http.post<any>(`${this.API}/pos/cotizaciones`, payload);
  }

  convertirCotizacionAVenta(idCotizacion: number) {
    return this.http.patch<any>(`${this.API}/pos/cotizaciones/${idCotizacion}/convertir`, {});
  }

  actualizarCotizacion(idCotizacion: number, payload: any) {
    return this.http.patch<any>(`${this.API}/pos/cotizaciones/${idCotizacion}`, payload);
  }

  cambiarEstatusCotizacion(idCotizacion: number, estatus: string) {
    return this.http.patch<any>(`${this.API}/pos/cotizaciones/${idCotizacion}/estatus`, { estatus });
  }

  facturarCotizacion(idCotizacion: number, payload: any) {
    return this.http.post<any>(`${this.API}/pos/cotizaciones/${idCotizacion}/facturar`, payload);
  }
}

