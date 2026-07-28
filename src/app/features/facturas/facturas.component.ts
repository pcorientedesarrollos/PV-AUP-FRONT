import { Component, OnInit, signal, computed } from '@angular/core';
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

    this.http.post<any>('http://localhost:3000/pos/utils/parse-csf', fd).subscribe({
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
    this.http.get<any[]>('http://localhost:3000/pos/clientes', {
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

  cargarFacturas() {
    this.cargando.set(true);
    this.http.get<any[]>('http://localhost:3000/pos/facturas', {
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

  abrirModalFactura() {
    this.errorFactura.set('');
    this.idVenta.set(null);
    this.folioVenta.set('');
    this.formData.rfc = '';
    this.formData.razonSocial = '';
    this.formData.cp = '';
    this.mostrarModal.set(true);
  }

  cerrarModal() {
    this.mostrarModal.set(false);
  }

  buscarVentaPorFolio() {
    if (!this.folioVenta()) return;
    const query = this.folioVenta().trim();
    this.http.get<any[]>(`http://localhost:3000/pos/ventas?folio=${query}`, {
      headers: { 'x-sucursal-id': this.idSucursalSesion.toString() }
    }).subscribe({
      next: (ventas) => {
        const v = ventas.length > 0 ? ventas[0] : null;
        if (v) {
          this.idVenta.set(v.idVenta);
          this.errorFactura.set('');
          // AUTO RELLENAR SI HAY CLIENTE
          if (v.cliente) {
            if (v.cliente.rfc) this.formData.rfc = v.cliente.rfc;
            if (v.cliente.nombreCompleto) this.formData.razonSocial = v.cliente.nombreCompleto;
            // Extraer CP de la dirección si existe
            if (v.cliente.direccion) {
              const cpMatch = v.cliente.direccion.match(/\b\d{5}\b/);
              if (cpMatch) this.formData.cp = cpMatch[0];
            }
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

    this.http.post<any>(`http://localhost:3000/pos/facturar/${this.idVenta()}`, this.formData).subscribe({
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
    if(url) window.open(url, '_blank');
  }

  descargarXml(url: string) {
    if(url) {
      const encodedUrl = encodeURIComponent(url);
      
      this.http.get(`http://localhost:3000/pos/proxy/descargar-xml?url=${encodedUrl}`, {
        responseType: 'blob' // Lo obtenemos como archivo binario (blob)
      }).subscribe({
        next: (blob) => {
          // Creamos una URL temporal para el blob
          const downloadUrl = window.URL.createObjectURL(blob);
          
          // Creamos un enlace invisible y forzamos el clic
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = 'factura.xml'; // Nombre sugerido para la descarga
          
          document.body.appendChild(link);
          link.click();
          
          // Limpiamos el DOM y la memoria
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
        },
        error: (err) => {
          console.error('Error al descargar el XML:', err);
          alert('Hubo un error al intentar descargar el archivo XML.');
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