import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface TicketConfig {
  nombreEmpresa?: string;
  nombreNegocio?: string; // fallback
  direccion: string;
  telefono: string;
  rfc: string;
  mensajeTicket: string;
  anchoTicket: string;
  imprimirLogo: boolean;
}

@Injectable({ providedIn: 'root' })
export class TicketPrinterService {
  private configCache: TicketConfig | null = null;
  private cachedSucursalId: number | null = null;
  private readonly API = 'http://localhost:3000/pos/configuracion';

  constructor(private http: HttpClient, private auth: AuthService) {}

  async getConfig(): Promise<TicketConfig> {
    const currentSucursalId = this.auth.sesion()?.idSucursal || null;
    
    // Invalidate cache if sucursal changed
    if (this.cachedSucursalId !== currentSucursalId) {
      this.clearCache();
    }

    if (this.configCache) return this.configCache;
    
    try {
      const data = await firstValueFrom(this.http.get<TicketConfig>(this.API));
      if (data) {
        this.configCache = data;
        this.cachedSucursalId = currentSucursalId;
        return data;
      }
    } catch (e) {
      console.error('Error fetching config for printer', e);
    }
    // Fallback default
    return {
      nombreNegocio: 'AUP POS',
      direccion: '',
      telefono: '',
      rfc: '',
      mensajeTicket: '¡Gracias por su compra!',
      anchoTicket: '80mm',
      imprimirLogo: false,
    };
  }

  clearCache() {
    this.configCache = null;
  }

  // --- Funciones de Estilos Comunes ---
  private getBaseHtmlHeader(title: string, config: TicketConfig): string {
    const is58 = config.anchoTicket === '58mm';
    const fontSize = is58 ? '10px' : '12px';
    
    let logoUrl = this.auth.sesion()?.empresa?.logoUrl || '/logo.png';
    if (logoUrl.startsWith('/uploads')) {
      logoUrl = 'http://localhost:3000' + logoUrl;
    } else if (!logoUrl.startsWith('http')) {
      logoUrl = (typeof window !== 'undefined' ? window.location.origin : '') + logoUrl;
    }

    const paperWidth = config.anchoTicket === '58mm' ? '58mm' : '80mm';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @page {
            size: ${paperWidth} auto;
            margin: 0;
          }
          @media print {
            body { max-width: 100% !important; margin: 0; }
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: ${fontSize};
            width: ${paperWidth};
            max-width: ${paperWidth};
            margin: 0 auto;
            padding: 4mm;
            box-sizing: border-box;
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: bold; }
          .mb-1 { margin-bottom: 5px; }
          .mb-2 { margin-bottom: 10px; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; font-size: ${fontSize}; }
          th, td { padding: 2px 0; vertical-align: top; }
          .item { display: flex; justify-content: space-between; margin-bottom: 3px; }
        </style>
      </head>
      <body>
        <div class="text-center mb-2">
          ${config.imprimirLogo ? `<img src="${logoUrl}" style="max-height: 40px; margin-bottom: 5px;" /><br>` : ''}
          <div class="bold" style="font-size: 1.2em;">${config.nombreEmpresa || config.nombreNegocio || 'AUP POS'}</div>
          ${config.direccion ? `<div>${config.direccion}</div>` : ''}
          ${config.telefono ? `<div>Tel: ${config.telefono}</div>` : ''}
          ${config.rfc ? `<div>RFC: ${config.rfc}</div>` : ''}
        </div>
    `;
  }

  // --- HTML Ticket de Venta ---
  generarHTMLVenta(venta: any, config: TicketConfig): string {
    let html = this.getBaseHtmlHeader('Ticket de Venta', config);

    html += `
        <div class="divider"></div>
        <div class="mb-1">
          <div>Ticket #${venta.idCajaChica || venta.id || 'N/A'}</div>
          <div>Fecha: ${venta.fecha || new Date().toLocaleString()}</div>
          <div>Caja: TERMINAL 01</div>
          <div>Cliente: Público en General</div>
        </div>
        <div class="divider"></div>

        <table class="mb-2">
          <thead>
            <tr>
              <th class="text-left" style="width: 15%;">Cant</th>
              <th class="text-left" style="width: 55%;">Desc</th>
              <th class="text-right" style="width: 30%;">Importe</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (venta.detalles && Array.isArray(venta.detalles)) {
      venta.detalles.forEach((d: any) => {
        const nombre = d.productoNombre || (d.producto?.nombre) || 'Producto';
        html += `
            <tr>
              <td class="text-left">${d.cantidad}</td>
              <td class="text-left">${nombre}</td>
              <td class="text-right">$${Number(d.importe || 0).toFixed(2)}</td>
            </tr>
        `;
      });
    }

    html += `
          </tbody>
        </table>
        <div class="divider"></div>
        
        <div class="text-right bold mb-1" style="font-size: 1.1em;">
          TOTAL: $${Number(venta.total || 0).toFixed(2)}
        </div>
        <div class="text-center mb-2" style="font-size: 0.9em;">
          <span>Efectivo: $${Number(venta.efectivoRecibido || venta.total || 0).toFixed(2)}</span><br>
          <span>Cambio: $${Number(venta.cambio || 0).toFixed(2)}</span>
        </div>
        
        <div class="text-center bold" style="margin-top: 15px;">
          ${config.mensajeTicket || '¡Gracias por su compra!'}
        </div>
        <br>
      </body>
      </html>
    `;
    return html;
  }

  // --- HTML Corte de Caja (Z) ---
  generarHTMLCorte(data: any, config: TicketConfig): string {
    let html = this.getBaseHtmlHeader('Corte de Caja', config);
    const diff = Number(data.diferencia || 0);
    let textoDiff = 'CUADRE EXACTO';
    if (diff > 0) textoDiff = `SOBRANTE: +$${diff.toFixed(2)}`;
    else if (diff < 0) textoDiff = `FALTANTE: -$${Math.abs(diff).toFixed(2)}`;

    html += `
        <div class="text-center mb-1">
          <p class="bold" style="margin: 5px 0;">CORTE DE CAJA (Z)</p>
          <p style="margin: 0;">Fecha: ${data.fecha || new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="divider"></div>
        
        <div class="item">
          <span>Fondo Inicial:</span>
          <span>$${Number(data.fondoCaja || data.aperturasCaja || 0).toFixed(2)}</span>
        </div>
        <div class="item">
          <span>Total Ventas (${data.numeroVentas || 0}):</span>
          <span>$${Number(data.totalVentas || 0).toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="item">
          <span>Ventas Efectivo:</span>
          <span>$${Number(data.ventasEfectivo || data.totalEfectivo || 0).toFixed(2)}</span>
        </div>
        <div class="item">
          <span>Ventas Tarjeta:</span>
          <span>$${Number(data.ventasTarjeta || data.totalTarjeta || 0).toFixed(2)}</span>
        </div>
        <div class="item">
          <span>Ventas Transfer:</span>
          <span>$${Number(data.ventasTransferencia || data.totalTransferencia || 0).toFixed(2)}</span>
        </div>
        <div class="item">
          <span>Devoluciones:</span>
          <span>$${Number(data.totalCancelado || data.devoluciones || 0).toFixed(2)}</span>
        </div>

        <div class="divider"></div>
        
        <div class="item bold">
          <span>TOTAL ESPERADO (EF):</span>
          <span>$${Number(data.totalTeoricoFisico || 0).toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="item">
          <span>EFECTIVO CONTADO:</span>
          <span>$${Number(data.efectivoContado || 0).toFixed(2)}</span>
        </div>
        <div class="item bold" style="margin-top: 10px;">
          <span>RESULTADO:</span>
          <span>${textoDiff}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="text-center" style="margin-top: 25px;">
          <p>Firma Cajero</p>
          <br><br>
          <p>____________________</p>
        </div>
      </body>
      </html>
    `;
    return html;
  }

  // --- HTML Vale de Almacén ---
  generarHTMLValeAlmacen(data: any, config: TicketConfig): string {
    let html = this.getBaseHtmlHeader('Vale de Almacén', config);

    html += `
        <div class="text-center mb-1">
          <h2 class="bold" style="margin: 0; font-size: 1.1em;">COMPROBANTE DE ALMACÉN</h2>
          <p style="margin: 5px 0;">Almacén: ${data.almacen || ''}</p>
        </div>
        
        <div class="divider"></div>
        <div class="text-left mb-1">
          <p class="mb-1"><strong>ID Movi:</strong> #${data.id}</p>
          <p class="mb-1"><strong>Concepto:</strong> ${data.concepto || 'S/N'}</p>
          <p class="mb-1"><strong>Descripción:</strong> ${data.descripcion}</p>
          <p class="mb-1"><strong>Tipo:</strong> ${data.tipo}</p>
          <p class="mb-1"><strong>Cantidad:</strong> ${data.cantidad}</p>
          <p class="mb-1"><strong>Costo U.:</strong> $${Number(data.costoUnitario).toFixed(2)}</p>
          <p class="mb-1"><strong>Importe:</strong> $${Number(data.importe).toFixed(2)}</p>
        </div>
        <div class="divider"></div>
        
        <div class="text-center" style="margin-top: 30px;">
          <p>Firma de Recepción / Entrega</p>
          <br><br>
          <p>____________________</p>
        </div>
      </body>
      </html>
    `;
    return html;
  }

  // --- API para imprimir ---
  async imprimirTicketVenta(venta: any, configFicticia?: TicketConfig) {
    const config = configFicticia || await this.getConfig();
    const html = this.generarHTMLVenta(venta, config);
    this.abrirVentanaEImprimir(html);
  }

  async imprimirCorteCaja(data: any, configFicticia?: TicketConfig) {
    const config = configFicticia || await this.getConfig();
    const html = this.generarHTMLCorte(data, config);
    this.abrirVentanaEImprimir(html);
  }

  async imprimirValeAlmacen(data: any, configFicticia?: TicketConfig) {
    const config = configFicticia || await this.getConfig();
    const html = this.generarHTMLValeAlmacen(data, config);
    this.abrirVentanaEImprimir(html);
  }

  async imprimirTextoDirecto(texto: string, configFicticia?: TicketConfig) {
    const config = configFicticia || await this.getConfig();
    const paperWidth = config.anchoTicket === '58mm' ? '58mm' : '80mm';
    const is58 = config.anchoTicket === '58mm';
    const fontSize = is58 ? '10px' : '12px';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte Impreso</title>
        <style>
          @page { size: ${paperWidth} auto; margin: 0; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            font-size: ${fontSize}; 
            width: ${paperWidth};
            max-width: ${paperWidth};
            margin: 0 auto; 
            padding: 4mm; 
            box-sizing: border-box;
            color: #000;
            background: #fff;
          }
          pre {
            white-space: pre-wrap;
            font-family: inherit;
            margin: 0;
            font-size: inherit;
          }
        </style>
      </head>
      <body>
        <pre>${texto}</pre>
      </body>
      </html>
    `;
    this.abrirVentanaEImprimir(html);
  }

  private abrirVentanaEImprimir(html: string) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Esperar a que rendericen fuentes y logo
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
      }, 500);
    } else {
      alert('Por favor permite las ventanas emergentes (pop-ups) para poder imprimir el ticket.');
    }
  }
}
