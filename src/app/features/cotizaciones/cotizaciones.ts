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

  cotizaciones = signal<any[]>([]);
  cargando = signal(true);

  // Modal de Facturación
  mostrarModalFactura = signal(false);
  facturando = signal(false);
  errorFactura = signal('');
  idCotizacionAFacturar = signal<number | null>(null);
  folioCotizacionAFacturar = signal('');

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

  nuevaCotizacion() {
    this.router.navigate(['/cotizaciones/nueva']);
  }

  convertirAVenta(idCotizacion: number) {
    if (confirm('¿Estás seguro de convertir esta cotización a venta? Esto afectará el inventario.')) {
      this.posService.convertirCotizacionAVenta(idCotizacion).subscribe({
        next: (res) => {
          if (res.success) {
            this.toast.show('Cotización convertida a venta exitosamente', 'success');
            this.cargarCotizaciones();
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
    
    // Crear una ventana de impresión nativa (funciona para Imprimir y Guardar como PDF)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.toast.show('Por favor permite las ventanas emergentes (pop-ups)', 'error');
      return;
    }
    
    const clienteNombre = cot.cliente ? cot.cliente.nombreCompleto : (cot.nombreClienteTemporal || 'Público General');
    
    let html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Cotización ${cot.folio}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 40px; 
              color: #1e293b; 
              background: #fff; 
            }
            .document-container { max-width: 800px; margin: auto; }
            .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .company-info h1 { margin: 0; font-size: 28px; color: #0f172a; font-weight: 800; letter-spacing: -0.5px; }
            .company-info p { margin: 4px 0; color: #64748b; font-size: 14px; }
            .quote-info { text-align: right; }
            .quote-title { font-size: 24px; color: #4338ca; margin: 0 0 10px 0; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            .quote-meta { font-size: 14px; color: #475569; margin: 4px 0; }
            .customer-section { background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
            .customer-section h3 { margin: 0 0 10px 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
            .customer-name { margin: 0; font-size: 18px; font-weight: 600; color: #0f172a; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; }
            th { background: #4338ca; color: white; padding: 12px 15px; text-align: left; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
            th:first-child { border-top-left-radius: 6px; border-bottom-left-radius: 6px; }
            th:last-child { border-top-right-radius: 6px; border-bottom-right-radius: 6px; text-align: right; }
            td { padding: 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; }
            td:last-child { text-align: right; font-weight: 600; }
            .totals-container { display: flex; justify-content: flex-end; margin-bottom: 40px; }
            .totals-box { width: 300px; background: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #475569; }
            .total-row.grand-total { border-top: 2px solid #cbd5e1; margin-top: 10px; padding-top: 15px; font-size: 18px; font-weight: 800; color: #0f172a; }
            .conditions { font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .conditions h4 { color: #334155; margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; }
            .conditions ul { margin: 0; padding-left: 20px; }
          </style>
        </head>
        <body>
          <div class="document-container">
            <div class="header-top">
              <div class="company-info">
                <h1>AUP SISTEMAS</h1>
                <p>Soluciones Tecnológicas Integrales</p>
                <p>RFC: AUP000000XXX</p>
              </div>
              <div class="quote-info">
                <h2 class="quote-title">COTIZACIÓN</h2>
                <p class="quote-meta"><strong>Folio:</strong> ${cot.folio}</p>
                <p class="quote-meta"><strong>Fecha:</strong> ${new Date(cot.fechaEmision).toLocaleDateString()}</p>
                <p class="quote-meta"><strong>Válido hasta:</strong> ${(() => {
                  const d = new Date(cot.fechaEmision);
                  d.setDate(d.getDate() + cot.vigenciaDias);
                  return d.toLocaleDateString();
                })()}</p>
              </div>
            </div>
            
            <div class="customer-section">
              <h3>Datos del Cliente</h3>
              <p class="customer-name">${clienteNombre}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Cant.</th>
                  <th>Concepto / Descripción</th>
                  <th>Precio Público</th>
                  <th>Aplica IVA</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
    `;
    
    if (cot.detalles && cot.detalles.length > 0) {
      cot.detalles.forEach((d: any) => {
        const unitarioFinal = Number(d.importe) / Number(d.cantidad);
        html += `
          <tr>
            <td>${d.cantidad}</td>
            <td><strong>${d.producto?.nombre || d.nombreConcepto || 'Producto / Servicio'}</strong></td>
            <td>$${unitarioFinal.toFixed(2)}</td>
            <td>${d.aplicaIva ? 'Sí' : 'No'}</td>
            <td>$${Number(d.importe).toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      html += `<tr><td colspan="4" style="text-align: center; color: #94a3b8; font-style: italic;">Sin conceptos en esta cotización</td></tr>`;
    }
    
    html += `
              </tbody>
            </table>
            
            <div class="totals-container">
              <div class="totals-box">
                <div class="total-row">
                  <span>Subtotal:</span>
                  <span>$${Number(cot.subtotal).toFixed(2)}</span>
                </div>
                <div class="total-row">
                  <span>IVA (16%):</span>
                  <span>$${Number(cot.totalIva).toFixed(2)}</span>
                </div>
                <div class="total-row grand-total">
                  <span>Total:</span>
                  <span>$${Number(cot.total).toFixed(2)} MXN</span>
                </div>
              </div>
            </div>

            <div class="conditions">
              <h4>Condiciones Comerciales</h4>
              <ul>
                <li><strong>Tiempo de entrega:</strong> A convenir (sujeto a disponibilidad de inventario).</li>
                <li><strong>Condiciones de pago:</strong> 50% de anticipo al confirmar el pedido, 50% restante contra entrega.</li>
                <li><strong>Tipo de cambio:</strong> Los precios en dólares (si aplican) se pagarán al tipo de cambio del Diario Oficial de la Federación (DOF) del día de la facturación.</li>
                <li>Precios sujetos a cambio sin previo aviso.</li>
                <li>Esta cotización no representa una factura ni un comprobante fiscal.</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Llamar a print inmediatamente
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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
