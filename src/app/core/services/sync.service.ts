import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { get, set } from 'idb-keyval';
import { CheckoutPayload } from '../interfaces';

export interface PendingSale {
  idLocal: string;
  payload: CheckoutPayload;
  fecha: Date;
  estado: 'pendiente' | 'error' | 'sincronizado';
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly API = 'http://localhost:3000';
  private readonly STORE_KEY = 'ventas_pendientes';

  // Señales de estado
  public isOnline = signal<boolean>(navigator.onLine);
  public ventasPendientes = signal<PendingSale[]>([]);
  public syncInProgress = signal<boolean>(false);

  constructor(private http: HttpClient) {
    this.initNetworkListeners();
    this.cargarVentasPendientes();
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.intentarSincronizacion();
    });
    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }

  async cargarVentasPendientes() {
    const ventas = await get<PendingSale[]>(this.STORE_KEY) || [];
    this.ventasPendientes.set(ventas);
  }

  async guardarVentaPendiente(payload: CheckoutPayload) {
    const nuevaVenta: PendingSale = {
      idLocal: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      payload,
      fecha: new Date(),
      estado: 'pendiente'
    };

    const ventasActuales = await get<PendingSale[]>(this.STORE_KEY) || [];
    ventasActuales.push(nuevaVenta);
    await set(this.STORE_KEY, ventasActuales);
    this.ventasPendientes.set(ventasActuales);
  }

  async intentarSincronizacion() {
    if (!this.isOnline() || this.syncInProgress()) return;

    const pendientes = this.ventasPendientes().filter(v => v.estado === 'pendiente');
    if (pendientes.length === 0) return;

    this.syncInProgress.set(true);
    let allVentas = await get<PendingSale[]>(this.STORE_KEY) || [];

    for (const venta of pendientes) {
      try {
        await this.http.post(`${this.API}/cajachica/checkout`, venta.payload).toPromise();
        
        // Marcar como sincronizada
        const idx = allVentas.findIndex(v => v.idLocal === venta.idLocal);
        if (idx !== -1) {
          allVentas[idx].estado = 'sincronizado';
        }
      } catch (err) {
        console.error('Error sincronizando venta local:', venta.idLocal, err);
        // Si hay error, se queda en estado pendiente y se reintentará luego
      }
    }

    // Limpiar sincronizadas
    allVentas = allVentas.filter(v => v.estado !== 'sincronizado');
    await set(this.STORE_KEY, allVentas);
    this.ventasPendientes.set(allVentas);
    this.syncInProgress.set(false);
  }
}
