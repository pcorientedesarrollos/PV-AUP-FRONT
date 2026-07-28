import { environment } from '../../../environments/environment';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TicketPrinterService } from '../../core/services/ticket-printer.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-configuracion-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracion-ticket.component.html'
})
export class ConfiguracionTicketComponent implements OnInit {
  idSucursalSesion = 0;

  cargando = true;
  guardando = false;
  mensajeExito = false;
  mensajeError = '';

  configSucursal = {
    idSucursal: 0, 
    nombreEmpresa: '', 
    rfcEmpresa: '',
    direccion: '', 
    telefono: '', 
    iva: 0,
    anchoTicket: '80mm', 
    imprimirLogo: false, 
    mensajeTicket: ''
  };

  previewHtmlStr: SafeHtml | null = null;

  constructor(
    private http: HttpClient,
    private printer: TicketPrinterService,
    private sanitizer: DomSanitizer,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    (function(...args: any[]){})('ConfiguracionTicketComponent instanciado');
  }

  ngOnInit() {
    try {
      (function(...args: any[]){})('ConfiguracionTicketComponent ngOnInit');
      const ses = this.auth.sesion();
      if (!ses) {
        this.cargando = false;
        this.mensajeError = 'No se encontró la sesión del usuario.';
        return;
      }

      this.idSucursalSesion = ses.idSucursal || 0;

      if (this.idSucursalSesion) {
        this.cargarConfiguracion(this.idSucursalSesion);
      } else {
        this.updatePreview();
        this.cargando = false;
      }
    } catch(e) {
      (function(...args: any[]){})('Error en ngOnInit de ConfiguracionTicketComponent', e);
      this.cargando = false;
      this.mensajeError = 'Error interno al inicializar: ' + e;
    }
  }

  cargarConfiguracion(idSucursal: number) {
    this.cargando = true;
    this.mensajeError = '';

    this.http.get<any>(`${environment.apiUrl}/pos/configuracion`, {
      headers: { 'x-sucursal-id': idSucursal.toString() }
    }).subscribe({
      next: (d) => {
        this.configSucursal = {
          idSucursal,
          nombreEmpresa: d?.nombreEmpresa || '',
          rfcEmpresa:    d?.rfcEmpresa    || '',
          direccion:     d?.direccion     || '',
          telefono:      d?.telefono      || '',
          iva:           d?.iva           ?? 0,
          anchoTicket:   d?.anchoTicket   || '80mm',
          imprimirLogo:  d?.imprimirLogo  || false,
          mensajeTicket: d?.mensajeTicket || ''
        };
        this.updatePreview();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        (function(...args: any[]){})('Error cargando configuración:', err);
        this.configSucursal.idSucursal = idSucursal;
        this.updatePreview();
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  updatePreview() {
    try {
      if (!this.configSucursal) return;
      const cfg = {
        nombreNegocio: this.configSucursal.nombreEmpresa || 'Mi Negocio',
        direccion:     this.configSucursal.direccion || '',
        telefono:      this.configSucursal.telefono || '',
        rfc:           this.configSucursal.rfcEmpresa || '',
        mensajeTicket: this.configSucursal.mensajeTicket || '',
        anchoTicket:   this.configSucursal.anchoTicket || '80mm',
        imprimirLogo:  this.configSucursal.imprimirLogo || false
      };
      
      const htmlStr = this.printer.generarHTMLVenta({
        id: '0001', fecha: new Date().toLocaleString(),
        nombreUsuario: 'Admin', nombreCliente: 'PÚBLICO GENERAL',
        descuento: 0, totalCobrado: 450, metodoPago: 'Efectivo',
        total: 450, efectivoRecibido: 500, cambio: 50,
        detalles: [
          { productoNombre: 'Producto Ejemplo 1', cantidad: 2, precioUnitario: 100, importe: 200 },
          { productoNombre: 'Producto Ejemplo 2', cantidad: 1, precioUnitario: 250, importe: 250 }
        ]
      }, cfg);
      this.previewHtmlStr = this.sanitizer.bypassSecurityTrustHtml(htmlStr);
    } catch (e) {
      (function(...args: any[]){})(e);
      this.previewHtmlStr = this.sanitizer.bypassSecurityTrustHtml(
        '<p style="color:#94a3b8;font-size:11px;text-align:center;">Vista previa no disponible</p>'
      );
    }
  }

  guardarConfiguracion() {
    if (this.guardando) return;
    this.guardando = true;
    this.mensajeExito = false;
    this.mensajeError = '';
    this.cdr.detectChanges();
    
    this.http.patch(`${environment.apiUrl}/pos/configuracion`, this.configSucursal, {
      headers: { 'x-sucursal-id': this.idSucursalSesion.toString() }
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.printer.clearCache();
        this.mostrarExito();
        this.updatePreview();
        this.cdr.detectChanges();
      },
      error: (err) => { 
        (function(...args: any[]){})(err);
        this.guardando = false; 
        this.mensajeError = 'Hubo un error al intentar guardar la configuración del ticket. Por favor revisa la conexión.';
        this.cdr.detectChanges();
      }
    });
  }

  mostrarExito() {
    this.mensajeExito = true;
    setTimeout(() => { this.mensajeExito = false; this.cdr.detectChanges(); }, 4000);
  }
}
