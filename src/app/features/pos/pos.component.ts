import { Component, signal, OnInit, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PosService } from '../../core/services/pos.service';
import { ThemeService } from '../../core/services/theme.service';
import { ConfigService } from '../../core/services/config.service';
import { CatalogoComponent } from './catalogo/catalogo.component';
import { CarritoComponent } from './carrito/carrito.component';
import { AperturaCajaComponent } from './apertura-caja/apertura-caja.component';
import { ClienteRapidoComponent } from './cliente-rapido/cliente-rapido.component';
import { Cliente } from '../../core/interfaces';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule,
    CatalogoComponent,
    CarritoComponent,
    AperturaCajaComponent,
    ClienteRapidoComponent,
  ],
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {
  @ViewChild('carritoRef') carritoRef!: CarritoComponent;
  @ViewChild(CatalogoComponent) catalogoRef!: CatalogoComponent;

  carritoVisible = signal(false);
  mostrarNuevoCliente = signal(false);
  turnoAbierto = signal(false);

  // Corte de Caja
  mostrarCorteCaja = signal(false);
  datosCorte = signal<any>(null);

  // Escáner de código de barras global
  barcodeBuffer = '';
  lastScanTime = 0;

  constructor(
    public auth: AuthService, 
    public pos: PosService, 
    private router: Router, 
    public theme: ThemeService,
    public config: ConfigService
  ) {}

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'F3') {
      event.preventDefault();
      if (this.catalogoRef) {
        this.catalogoRef.enfocarBuscador();
      }
    }

    if (event.key === 'F12') {
      if (this.carritoRef && this.pos.carrito().length > 0) {
        event.preventDefault();
        this.carritoRef.cobrar();
      }
      return;
    }

    const target = event.target as HTMLElement;
    // Ignorar si el usuario está escribiendo manualmente en el buscador (para no agregar el producto 2 veces)
    if (target && target.tagName === 'INPUT' && target.id === 'buscador-productos') {
      return; 
    }

    const currentTime = new Date().getTime();
    
    // Si pasaron más de 50ms desde la última tecla, reseteamos el buffer
    // (Un humano teclea lento, un escáner teclea rapidísimo en menos de 20ms por letra)
    if (currentTime - this.lastScanTime > 50) {
      this.barcodeBuffer = '';
    }
    this.lastScanTime = currentTime;

    // Agregar tecla al buffer si es un caracter imprimible (letra, número o símbolo)
    if (event.key.length === 1) {
      this.barcodeBuffer += event.key;
    }

    // Si detectamos un "Enter" y tenemos un código largo en el buffer
    if (event.key === 'Enter' && this.barcodeBuffer.length >= 3) {
      this.buscarYAgregarPorCodigo(this.barcodeBuffer);
      this.barcodeBuffer = '';
      event.preventDefault();
    }
  }

  buscarYAgregarPorCodigo(codigo: string) {
    const query = codigo.toLowerCase().trim();
    this.pos.buscarProductoPorCodigo(query).subscribe({
      next: (productoEncontrado) => {
        if (productoEncontrado) {
          this.pos.agregarAlCarrito(productoEncontrado);
        } else {
          console.warn('Producto no encontrado en escaneo global:', codigo);
        }
      },
      error: (err) => {
        console.warn('Error en escaneo global:', err);
      }
    });
  }

  navegar(ruta: string) {
    this.router.navigate([ruta]);
  }

  ngOnInit() {
    this.turnoAbierto.set(this.auth.turnoAbierto());

    const checkTurno = setInterval(() => {
      if (this.auth.turnoAbierto()) {
        this.turnoAbierto.set(true);
        clearInterval(checkTurno);
      }
    }, 500);
  }

  isMobile = signal(window.innerWidth < 768);

  @HostListener('window:resize')
  onResize() {
    this.isMobile.set(window.innerWidth < 768);
  }

  logout() {
    this.auth.logout();
  }

  abrirCorteCaja() {
    const sesion = this.auth.sesion();
    if (!sesion?.idUsuario) return;
    this.pos.getCorteDeCaja(sesion.idUsuario).subscribe({
      next: (data) => {
        this.datosCorte.set(data);
        this.mostrarCorteCaja.set(true);
      },
      error: (err) => console.error('Error al obtener corte de caja:', err)
    });
  }

  cerrarCorteCaja() {
    this.mostrarCorteCaja.set(false);
  }

  onClienteCreado(cliente: Cliente) {
    this.mostrarNuevoCliente.set(false);
    this.carritoRef?.agregarClienteALista(cliente);
  }
}
