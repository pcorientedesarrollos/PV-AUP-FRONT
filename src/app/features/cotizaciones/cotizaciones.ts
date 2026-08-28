import { AuthService } from '../../core/services/auth.service';
import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PosService } from '../../core/services/pos.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-cotizaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginacionComponent],
  templateUrl: './cotizaciones.html',
})
export class CotizacionesComponent implements OnInit {

  tamanoPagina = signal(10);
  paginaActual = signal(1);
  totalPaginas = computed(() => Math.ceil(this.cotizaciones().length / this.tamanoPagina()) || 1);
  
  registrosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.cotizaciones().slice(inicio, inicio + this.tamanoPagina());
  });

  private router = inject(Router);
  private posService = inject(PosService);
  private toast = inject(ToastService);
  public auth = inject(AuthService);

  cotizaciones = signal<any[]>([]);
  cargando = signal(true);

  // Modal de Facturación
  mostrarModalFactura = signal(false);
  facturando = signal(false);
  errorFactura = signal('');
  idCotizacionAFacturar = signal<number | null>(null);
  folioCotizacionAFacturar = signal('');
  conceptosCotizacionAFacturar = signal<any[]>([]);
  cotizacionObjAFacturar = signal<any>(null);

  formData = {
    rfc: '',
    razonSocial: '',
    cp: '',
    regimen: '601',
    usoCfdi: 'G03',
    formaPago: '01',
    metodoPago: 'PUE'
  };

  regimenes = [
    { id: '601', nombre: 'General de Ley Personas Morales' },
    { id: '605', nombre: 'Sueldos y Salarios e Ingresos Asimilados' },
    { id: '606', nombre: 'Arrendamiento' },
    { id: '612', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales' },
    { id: '626', nombre: 'Régimen Simplificado de Confianza' },
    { id: '616', nombre: 'Sin obligaciones fiscales' }
  ];

  usos = [
    { id: 'G01', nombre: 'Adquisición de mercancias' },
    { id: 'G03', nombre: 'Gastos en general' },
    { id: 'S01', nombre: 'Sin efectos fiscales' }
  ];

  formasPago = [
    { id: '01', nombre: 'Efectivo' },
    { id: '02', nombre: 'Cheque nominativo' },
    { id: '03', nombre: 'Transferencia electrónica de fondos' },
    { id: '04', nombre: 'Tarjeta de crédito' },
    { id: '28', nombre: 'Tarjeta de débito' },
    { id: '99', nombre: 'Por definir' }
  ];

  metodosPago = [
    { id: 'PUE', nombre: 'Pago en una sola exhibición' },
    { id: 'PPD', nombre: 'Pago en parcialidades o diferido' }
  ];

  ngOnInit() {
    this.cargarCotizaciones();
  }

  cargarCotizaciones() {
    this.cargando.set(true);
    this.posService.getCotizaciones().subscribe({
      next: (data) => {
        this.cotizaciones.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.toast.show('Error al cargar cotizaciones', 'error');
        this.cargando.set(false);
      }
    });
  }

  calcularVencimiento(fechaStr: string, dias: number): Date {
    const d = new Date(fechaStr);
    d.setDate(d.getDate() + (dias || 0));
    return d;
  }

  duplicarCotizacion(cot: any) {
    this.router.navigate(['/cotizaciones/nueva'], { queryParams: { duplicarCotizacion: cot.idCotizacion } });
  }

  editarCotizacion(cot: any) {
    this.router.navigate(['/cotizaciones/nueva'], { queryParams: { editarCotizacion: cot.idCotizacion } });
  }

  nuevaCotizacion() {
    this.router.navigate(['/cotizaciones/nueva']);
  }

  convertirAVenta(idCotizacion: number) {
    if (confirm('¿Estás seguro de convertir esta cotización a venta? Esto afectará el inventario.')) {
      this.posService.convertirCotizacionAVenta(idCotizacion).subscribe({
        next: (res) => {
          if (res.success) {
            this.toast.show('Cotización convertida a venta exitosamente', 'success');
            if (res.venta && (res.venta.folio || res.venta.idVenta)) {
              this.router.navigate(['/facturas'], { queryParams: { facturarVenta: res.venta.folio || res.venta.idVenta, returnToHistorial: 'true' } });
            } else {
              this.cargarCotizaciones();
            }
          }
        },
        error: (err) => {
          this.toast.show(err.error?.message || 'Error al convertir a venta', 'error');
        }
      });
    }
  }

  facturarCotizacion(idCotizacion: number) {
    const cot = this.cotizaciones().find(c => c.idCotizacion === idCotizacion);
    if (!cot) return;
    
    this.idCotizacionAFacturar.set(idCotizacion);
    this.folioCotizacionAFacturar.set(cot.folio);
    this.conceptosCotizacionAFacturar.set(cot.detalles || []);
    this.cotizacionObjAFacturar.set(cot);
    this.errorFactura.set('');
    
    // Limpiar formData
    this.formData.rfc = '';
    this.formData.razonSocial = '';
    this.formData.cp = '';
    this.formData.regimen = '601';
    this.formData.usoCfdi = 'G03';
    this.formData.formaPago = '01';
    this.formData.metodoPago = 'PUE';

    // Auto rellenar si hay cliente
    if (cot.cliente) {
      if (cot.cliente.rfc) this.formData.rfc = cot.cliente.rfc;
      if (cot.cliente.nombreCompleto) this.formData.razonSocial = cot.cliente.nombreCompleto;
      if (cot.cliente.direccion) {
        const cpMatch = cot.cliente.direccion.match(/\b\d{5}\b/);
        if (cpMatch) this.formData.cp = cpMatch[0];
      }
      if (cot.cliente.regimenFiscal) this.formData.regimen = cot.cliente.regimenFiscal;
      if (cot.cliente.usoCfdi) this.formData.usoCfdi = cot.cliente.usoCfdi;
      if (cot.cliente.formaPago) this.formData.formaPago = cot.cliente.formaPago;
      if (cot.cliente.metodoPago) this.formData.metodoPago = cot.cliente.metodoPago;
    }

    this.mostrarModalFactura.set(true);
  }

  cerrarModalFactura() {
    this.mostrarModalFactura.set(false);
  }

  emitirFacturaCotizacion() {
    if (!this.idCotizacionAFacturar()) return;
    
    if (!this.formData.rfc || !this.formData.razonSocial || !this.formData.cp || !this.formData.regimen || !this.formData.usoCfdi) {
      this.errorFactura.set('Todos los campos del cliente son obligatorios para la factura 4.0');
      return;
    }

    if (this.formData.rfc.length < 12 || this.formData.rfc.length > 13) {
      this.errorFactura.set('El RFC debe tener 12 o 13 caracteres');
      return;
    }

    this.facturando.set(true);
    this.errorFactura.set('');

    this.posService.facturarCotizacion(this.idCotizacionAFacturar()!, this.formData).subscribe({
      next: (res) => {
        this.facturando.set(false);
        this.toast.show('Factura emitida exitosamente', 'success');
        this.cerrarModalFactura();
        this.cargarCotizaciones();
      },
      error: (err) => {
        this.facturando.set(false);
        this.errorFactura.set(err.error?.message || 'Error al emitir la factura');
      }
    });
  }

  imprimirCotizacion(idCotizacion: number) {
    const cot = this.cotizaciones().find(c => c.idCotizacion === idCotizacion);
    if (!cot) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.toast.show('Por favor permite las ventanas emergentes (pop-ups)', 'error');
      return;
    }
    
    const sesion = this.auth.sesion();
    const empresaNombre = sesion?.empresa?.nombre || 'Tu Empresa S.A. de C.V.';
    const logoUrl = sesion?.empresa?.logoUrl || '';
    const colorPrincipal = sesion?.empresa?.colorPrincipal || '#2c3e50';
    const direccion = sesion?.sucursalNombre || 'Dirección no especificada';

    const clienteNombre = cot.cliente ? cot.cliente.nombreCompleto : (cot.nombreClienteTemporal || 'Público General');
    
    let html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <title>Cotización ${cot.folio}</title>
          <style>
              body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.5; margin: 0; padding: 0; }
              .container { padding: 40px; }
              
              /* Titulo y Datos */
              .quote-title { font-size: 28px; color: ${colorPrincipal}; font-weight: bold; margin-bottom: 10px; }
              .meta-table { width: 100%; margin-bottom: 20px; }
              .meta-table td { vertical-align: top; }
              
              /* Datos del Cliente */
              .client-box { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
              .client-label { font-weight: bold; color: #7f8c8d; font-size: 10px; text-transform: uppercase; }
              
              /* Tabla de Productos */
              .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              .items-table th { background: ${colorPrincipal}; color: white; padding: 10px; text-align: left; font-size: 13px; }
              .items-table td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; }
              .items-table tr:nth-child(even) { background: #fafafa; }
              
              /* Totales */
              .totals-wrapper { width: 100%; }
              .totals-table { float: right; width: 30%; min-width: 200px; }
              .totals-table td { padding: 5px; text-align: right; font-size: 13px; }
              .total-row { font-weight: bold; font-size: 16px; color: ${colorPrincipal}; }

              /* Terminos y Condiciones */
              .terms { margin-top: 50px; font-size: 10px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 10px; }
              
              .text-right { text-align: right; }
          </style>
      </head>
      <body>
      <div class="container">
          <!-- Encabezado -->
          <table class="header">
              <tr>
                  <td>
                      ${logoUrl 
                        ? '<img src="' + logoUrl + '" alt="Logo" class="logo">' 
                        : '<h2>' + empresaNombre + '</h2>'}
                  </td>
                  <td class="company-info" style="text-align: right; font-size: 12px;">
                      <strong>${empresaNombre}</strong><br>
                      Sucursal: ${direccion}<br>
                  </td>
              </tr>
          </table>

          <hr style="border: 0; border-top: 2px solid ${colorPrincipal}; margin-bottom: 20px;">

          <!-- Titulo y Datos -->
          <table class="meta-table">
              <tr>
                  <td>
                      <div class="quote-title">COTIZACIÓN</div>
                      <p>Folio: <strong>${cot.folio}</strong><br>
                      Fecha: ${new Date(cot.fechaEmision).toLocaleDateString()}<br>
                      Vence: ${(() => {
                        const d = new Date(cot.fechaEmision);
                        d.setDate(d.getDate() + cot.vigenciaDias);
                        return d.toLocaleDateString();
                      })()}</p>
                  </td>
                  <td width="50%">
                      <div class="client-box">
                          <div class="client-label">CLIENTE:</div>
                          <strong>${clienteNombre}</strong><br>
                          ${cot.cliente?.direccion || 'Dirección no registrada'}<br>
                          RFC: ${cot.cliente?.rfc || 'XAXX010101000'}
                      </div>
                  </td>
              </tr>
          </table>

          <!-- Tabla de Items -->
          <table class="items-table">
              <thead>
                  <tr>
                      <th>Descripción</th>
                      <th width="10%" class="text-right">Cant.</th>
                      <th width="15%" class="text-right">Precio Unit.</th>
                      <th width="15%" class="text-right">Total</th>
                  </tr>
              </thead>
              <tbody>
    `;

    if (cot.detalles && cot.detalles.length > 0) {
      cot.detalles.forEach((d: any) => {
        const unitarioFinal = Number(d.importe) / Number(d.cantidad);
        html += `
          <tr>
            <td>${d.producto?.nombre || d.nombreConcepto || 'Producto / Servicio'}</td>
            <td class="text-right">${d.cantidad}</td>
            <td class="text-right">$${unitarioFinal.toFixed(2)}</td>
            <td class="text-right">$${Number(d.importe).toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      html += `<tr><td colspan="4" style="text-align: center; color: #94a3b8; font-style: italic;">Sin conceptos en esta cotización</td></tr>`;
    }

    html += `
              </tbody>
          </table>

          <!-- Seccion de Totales -->
          <div class="totals-wrapper">
              <table class="totals-table">
                  <tr>
                      <td>Subtotal:</td>
                      <td>$${Number(cot.subtotal).toFixed(2)}</td>
                  </tr>
                  <tr>
                      <td>IVA (16%):</td>
                      <td>$${Number(cot.totalIva).toFixed(2)}</td>
                  </tr>
                  <tr class="total-row">
                      <td>TOTAL:</td>
                      <td>$${Number(cot.total).toFixed(2)}</td>
                  </tr>
              </table>
          </div>

          <div style="clear: both;"></div>

          <!-- Terminos -->
          <div class="terms">
              <p><strong>Condiciones Comerciales:</strong></p>
              <ul>
                  <li>Precios sujetos a cambio sin previo aviso.</li>
                  <li>Vigencia de la cotización: ${cot.vigenciaDias} días a partir de la fecha de emisión.</li>
                  ${cot.observaciones ? '<li>Notas: ' + cot.observaciones + '</li>' : ''}
              </ul>
          </div>
      </div>
      <script>
          window.onload = function() { 
              setTimeout(function() { window.print(); }, 500); 
          }
          window.onafterprint = function() { window.close(); }
      </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }
  
  enviarCorreo(cot: any) {
    const clienteNombre = cot.cliente ? cot.cliente.nombreCompleto : (cot.nombreClienteTemporal || 'Público General');
    const email = cot.cliente?.email || '';
    
    const subject = encodeURIComponent(`Cotización ${cot.folio} - AUP POS`);
    const body = encodeURIComponent(`Hola ${clienteNombre},\n\nAdjuntamos los detalles de tu cotización con folio ${cot.folio}.\n\nTotal: $${Number(cot.total).toFixed(2)}\nVigencia: ${cot.vigenciaDias} días\n\nQuedamos a tus órdenes.\n\nSaludos,`);
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    
    this.toast.show('Abriendo tu cliente de correo...', 'success');
  }

  cancelarCotizacion(idCotizacion: number) {
    if (confirm('¿Deseas cancelar esta cotización?')) {
      this.posService.cambiarEstatusCotizacion(idCotizacion, 'Cancelada').subscribe({
        next: () => {
          this.toast.show('Cotización cancelada exitosamente', 'success');
          this.cargarCotizaciones();
        },
        error: () => this.toast.show('Error al cancelar la cotización', 'error')
      });
    }
  }
}
