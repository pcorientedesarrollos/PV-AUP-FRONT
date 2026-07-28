// Sesión del usuario autenticado
export interface Sesion {
  access_token?: string;
  idUsuario: number;
  usuario: string;
  idPerfil: number;
  idSucursal?: number;
  sucursalNombre?: string;
  empresa?: { idEmpresa: number; nombre: string; logoUrl: string; colorPrincipal?: string };
  app: number;
}

// Producto (PosProducto)
export interface Producto {
  idProducto: number;
  nombre: string;
  precioUnitario: number;
  precioPublico?: number;
  precioMayoreo?: number;
  stockActual?: number;
  stockMinimo?: number;
  imagenUrl?: string;
  codigoBarras?: string;
  iva?: number;
  claveProdServ?: string;
  claveUnidad?: string;
  idCategoria?: number;
  categoria?: { idCategoria: number; nombre?: string; };
}

// Línea del carrito de compras
export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
  subtotal: number;
}

// Cliente (PosCliente)
export interface Cliente {
  idCliente: number;
  nombreCompleto: string;
  direccion: string;
  telefono: string;
  rfc?: string;
  correo?: string;
}

// Payload para login
export interface LoginPayload {
  user: string;
  password: string;
}

// Payload para abrir turno
export interface AbrirTurnoPayload {
  nombre: string;
  montoApertura: number;
  idUsuario?: number;
}

// Payload para checkout
export interface CheckoutPayload {
  idCliente?: number;
  nombreCliente?: string;
  totalPagado: number;
  idUsuario?: number;
  idSucursal?: number;
  efectivoRecibido?: number;
  cambioEntregado?: number;
  carrito: ProductoVenta[];
}

export interface ProductoVenta {
  idProducto: number;
  cantidad: number;
  precioUnitario: number;
}

// Payload para alta rápida de cliente
export interface AltaRapidaPayload {
  nombreCompleto: string;
  direccion?: string;
  telefono?: string;
}

// Respuesta genérica
export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  mensaje?: string;
}

// Representa un carrito guardado en espera
export interface VentaPausada {
  id: number;
  timestamp: Date;
  cliente: Cliente | null;
  carrito: ItemCarrito[];
}
