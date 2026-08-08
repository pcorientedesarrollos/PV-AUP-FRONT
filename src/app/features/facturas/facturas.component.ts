import { Component, OnInit, signal, computed } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ExportService } from '../../core/services/export.service';
import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginacionComponent],
  templateUrl: './facturas.component.html',
  host: { 
    class: 'block w-full h-full min-w-full'
  }
})
export class FacturasComponent implements OnInit {

  paginaActual = signal(1);
  tamanoPagina = signal(10);
  
  totalPaginas = computed(() => Math.ceil(this.facturas().length / this.tamanoPagina()) || 1);

  facturasPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    const fin = inicio + this.tamanoPagina();
    return this.facturas().slice(inicio, fin);
  });
  
  registrosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    return this.facturas().slice(inicio, inicio + this.tamanoPagina());
  });

  facturas = signal<any[]>([]);
  ventasDisponibles = signal<any[]>([]);
  mostrarDropdownVentas = false;
  cargando = signal(false);
  idSucursalSesion = 0;

  // Modal para Nueva Factura
  mostrarModal = signal(false);
  facturando = signal(false);
  errorFactura = signal('');

  // Datos para emitir
  idVenta = signal<number | null>(null);
  folioVenta = signal('');
  
  subiendoCsf = signal(false);

  onCsfSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.subiendoCsf.set(true);
    const fd = new FormData();
    fd.append('file', file);

    this.http.post<any>(`${environment.apiUrl}/pos/utils/parse-csf`, fd).subscribe({
      next: (res) => {
        this.subiendoCsf.set(false);
        if (res.success) {
          if (res.rfc) this.formData.rfc = res.rfc;
          if (res.nombre) this.formData.razonSocial = res.nombre;
          if (res.cp) this.formData.cp = res.cp;
          if (res.regimenFiscal) this.formData.regimen = res.regimenFiscal;
        } else {
          alert('Error al leer Cédula: ' + (res.error || 'Formato no reconocido'));
        }
      },
      error: () => {
        this.subiendoCsf.set(false);
        alert('Error conectando al servidor para procesar la Cédula.');
      }
    });
  }

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

  clientesGuardados = signal<any[]>([]);

  constructor(private http: HttpClient, public auth: AuthService, public exportService: ExportService) {}

  ngOnInit() {
    const ses = this.auth.sesion();
    if (ses) {
      this.idSucursalSesion = ses.idSucursal || 0;
      this.cargarFacturas();
      this.cargarClientes();
    }
  }

  cargarClientes() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/clientes`, {
      headers: { 'x-sucursal-id': this.idSucursalSesion.toString() }
    }).subscribe({
      next: (data) => this.clientesGuardados.set(data),
      error: (err) => console.error('Error al cargar clientes:', err)
    });
  }

  seleccionarCliente(event: any) {
    const id = Number(event.target.value);
    if (!id) return;
    const cli = this.clientesGuardados().find(c => c.idCliente === id);
    if (cli) {
      this.formData.rfc = cli.rfc || '';
      this.formData.razonSocial = cli.nombreCompleto || '';
      this.formData.cp = cli.cp || '';
      this.formData.regimen = cli.regimenFiscal || '601';
      this.formData.usoCfdi = cli.usoCfdi || 'G03';
      this.formData.formaPago = cli.formaPago || '01';
      this.formData.metodoPago = cli.metodoPago || 'PUE';
    }
  }

  cancelarFactura(idFactura: number) {
    const motivo = prompt('Ingresa el motivo de cancelación (01, 02, 03, 04):', '02');
    if (!motivo) return;
    
    let payload: any = { motivo };
    if (motivo === '01') {
      const uuidSustitucion = prompt('Ingresa el UUID de sustitución:');
      if (!uuidSustitucion) return;
      payload.uuidSustitucion = uuidSustitucion;
    }
    
    this.http.post(`${environment.apiUrl}/pos/facturas/${idFactura}/cancelar`, payload).subscribe({
      next: () => {
        alert('Factura cancelada con éxito');
        this.cargarFacturas();
      },
      error: (err) => {
        alert('Error al cancelar factura: ' + (err.error?.message || err.message));
      }
    });
  }

  cargarFacturas() {
    this.cargando.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/pos/facturas`, {
      headers: { 'x-sucursal-id': this.idSucursalSesion.toString() }
    }).subscribe({
      next: (data) => {
        this.facturas.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error(err);
        this.cargando.set(false);
      }
    });
  }

    ocultarDropdownVentas() {
    setTimeout(() => this.mostrarDropdownVentas = false, 200);
  }

  seleccionarVentaDropdown(venta: any) {
    this.folioVenta.set(venta.folio || 'VTA-' + (venta.idCajaChica || venta.idVenta));
    this.mostrarDropdownVentas = false;
    
    this.idVenta.set(venta.idVenta || venta.idCajaChica);
    this.errorFactura.set('');
    
    if (venta.cliente) {
      this.formData = {
        ...this.formData,
        rfc: venta.cliente.rfc || '',
        razonSocial: venta.cliente.nombreCompleto || '',
        cp: venta.cliente.direccion ? (venta.cliente.direccion.match(/\b\d{5}\b/) || [''])[0] : ''
      };
    } else {
      this.formData = { ...this.formData, rfc: '', razonSocial: '', cp: '' };
    }
  }

  abrirModalFactura() {
    this.errorFactura.set('');
    this.idVenta.set(null);
    this.folioVenta.set('');
    this.formData.rfc = '';
    this.formData.razonSocial = '';
    this.formData.cp = '';
    this.mostrarModal.set(true);
    this.cargarVentasDisponibles();
  }

  cargarVentasDisponibles() {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30); // Ultimos 30 dias
    const fin = new Date();
    const strInicio = inicio.toISOString().split('T')[0];
    const strFin = fin.toISOString().split('T')[0];
    this.http.get<any[]>(`${environment.apiUrl}/pos/ventas?fechaInicio=${strInicio}&fechaFin=${strFin}`).subscribe({
      next: (ventas) => {
        const disponibles = ventas.filter(v => {
          if (v.estatus === 'Cancelada') return false;
          if (v.facturas && v.facturas.length > 0) {
            const facturada = v.facturas.some((f: any) => f.estatus === 'Emitida' || f.estatus === 'Procesando' || f.estatus === 'Completada');
            if (facturada) return false;
          }
          return true;
        });
        this.ventasDisponibles.set(disponibles);
      },
      error: () => console.error('Error al cargar ventas recientes')
    });
  }

  cerrarModal() {
    this.mostrarModal.set(false);
  }

  buscarVentaPorFolio() {
    if (!this.folioVenta()) return;
    const query = this.folioVenta().trim();
    
    const local = this.ventasDisponibles().find(v => v.folio === query || String(v.idVenta) === query || String(v.idCajaChica) === query || 'V-'+v.idVenta === query || 'VTA-'+v.idVenta === query);
    if (local) {
      this.seleccionarVentaDropdown(local);
      return;
    }

    this.http.get<any[]>(`${environment.apiUrl}/pos/ventas?folio=${query}`, {
      headers: { 'x-sucursal-id': this.idSucursalSesion.toString() }
    }).subscribe({
      next: (ventas) => {
        const v = ventas.length > 0 ? ventas[0] : null;
        if (v) {
          this.idVenta.set(v.idVenta);
          this.errorFactura.set('');
          // AUTO RELLENAR SI HAY CLIENTE
          if (v.cliente) {
            this.formData = {
              ...this.formData,
              rfc: v.cliente.rfc || '',
              razonSocial: v.cliente.nombreCompleto || '',
              cp: v.cliente.direccion ? (v.cliente.direccion.match(/\b\d{5}\b/) || [''])[0] : ''
            };
          } else {
             this.formData = { ...this.formData, rfc: '', razonSocial: '', cp: '' };
          }
        } else {
          this.idVenta.set(null);
          this.errorFactura.set('No se encontró una venta con ese folio.');
        }
      },
      error: () => this.errorFactura.set('Error buscando la venta.')
    });
  }

  emitirFactura() {
    if (!this.idVenta()) return;
    
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

    this.http.post<any>(`${environment.apiUrl}/pos/facturar/${this.idVenta()}`, this.formData).subscribe({
      next: (res) => {
        this.facturando.set(false);
        this.cerrarModal();
        this.cargarFacturas();
      },
      error: (err) => {
        this.facturando.set(false);
        this.errorFactura.set(err.error?.message || 'Error al emitir la factura');
      }
    });
  }

  descargarPdf(url: string) {
    if(url) {
      if (url.startsWith('/pos/facturas')) {
        window.open(`${environment.apiUrl}${url}`, '_blank');
      } else {
        window.open(url, '_blank');
      }
    }
  }

  descargarPaqueteCancelacion(idFactura: number) {
    if (idFactura) {
      window.open(`${environment.apiUrl}/pos/facturas/${idFactura}/paquete-cancelacion`, '_blank');
    }
  }

  descargarXml(url: string) {
    if(url) {
      if (url.startsWith('/pos/facturas')) {
        window.open(`${environment.apiUrl}${url}`, '_blank');
        return;
      }

      const encodedUrl = encodeURIComponent(url);
      
      this.http.get(`${environment.apiUrl}/pos/proxy/descargar-xml?url=${encodedUrl}`, {
        responseType: 'blob'
      }).subscribe({
        next: (blob) => {
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = 'factura.xml';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        },
        error: (err) => {
          alert('Error al descargar el XML. El servidor no permite la descarga directa o el enlace ya no es válido.');
        }
      });
    }
  }

  exportarExcel() {
    const data = this.facturas().map((f: any) => ({
      'UUID': f.uuid,
      'Fecha': new Date(f.fecha).toLocaleString(),
      'Total': f.total,
      'RFC Receptor': f.rfcReceptor,
      'Estatus': f.estatus,
      'ID Venta': f.venta?.idVenta || 'N/A'
    }));
    this.exportService.exportToExcel(data, 'Facturas');
  }

  exportarPDF() {
    const headers = ['UUID', 'Fecha', 'Total', 'RFC', 'Estatus', 'ID Venta'];
    const data = this.facturas().map((f: any) => [
      f.uuid || 'N/A',
      new Date(f.fecha).toLocaleString(),
      `$${f.total}`,
      f.rfcReceptor,
      f.estatus,
      f.venta?.idVenta?.toString() || 'N/A'
    ]);
    this.exportService.exportToPdf(headers, data, 'Reporte de Facturas', 'Facturas', 'l');
  }
}