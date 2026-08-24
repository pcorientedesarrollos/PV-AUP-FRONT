import { Component, OnInit, signal, inject, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-factura-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './factura-modal.component.html'
})
export class FacturaModalComponent implements OnInit, OnChanges {
  @Input() mostrar = false;
  @Input() prefillFolio: string | null = null;
  @Output() cerrar = new EventEmitter<void>();
  @Output() facturaEmitida = new EventEmitter<any>();

  private http = inject(HttpClient);
  public auth = inject(AuthService);

  cargando = signal(false);
  facturando = signal(false);
  errorFactura = signal('');
  subiendoCsf = signal(false);

  idSucursalSesion = 0;
  ventasDisponibles = signal<any[]>([]);
  mostrarDropdownVentas = false;
  
  idVenta = signal<number | null>(null);
  folioVenta = signal('');
  ventaSeleccionada = signal<any>(null);

  clientesGuardados = signal<any[]>([]);
  clienteBuscado = '';
  mostrarDropdownClientes = false;

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
    const ses = this.auth.sesion();
    if (ses) {
      this.idSucursalSesion = ses.idSucursal || 0;
      this.cargarClientes();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mostrar'] && changes['mostrar'].currentValue === true) {
      this.abrirModal();
      if (this.prefillFolio) {
        this.folioVenta.set(this.prefillFolio);
        setTimeout(() => {
          this.buscarVentaPorFolio();
        }, 500);
      }
    }
  }

  abrirModal() {
    this.errorFactura.set('');
    this.idVenta.set(null);
    this.folioVenta.set('');
    this.formData.rfc = '';
    this.formData.razonSocial = '';
    this.formData.cp = '';
    this.cargarVentasDisponibles();
  }

  cerrarModal() {
    this.cerrar.emit();
  }

  cargarClientes() {
    this.http.get<any[]>(`${environment.apiUrl}/pos/clientes?limit=1000`, {
      headers: { 'x-sucursal-id': this.idSucursalSesion.toString() }
    }).subscribe({
      next: (res: any) => this.clientesGuardados.set(res.data || res),
      error: (err) => console.error('Error al cargar clientes:', err)
    });
  }

  cargarVentasDisponibles() {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30);
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
          this.seleccionarVentaDirecta(v);
        } else {
          this.idVenta.set(null);
          this.ventaSeleccionada.set(null);
          this.errorFactura.set('No se encontró una venta con ese folio.');
        }
      },
      error: () => this.errorFactura.set('Error buscando la venta.')
    });
  }

  seleccionarVentaDropdown(venta: any) {
    this.folioVenta.set(venta.folio || 'VTA-' + (venta.idCajaChica || venta.idVenta));
    this.mostrarDropdownVentas = false;
    this.seleccionarVentaDirecta(venta);
  }

  private seleccionarVentaDirecta(v: any) {
    this.idVenta.set(v.idVenta || v.idCajaChica);
    this.ventaSeleccionada.set(v);
    this.errorFactura.set('');
    
    let maxAmount = 0;
    let dominantMethod = '01'; // Default Efectivo
    if (v.montoEfectivo > maxAmount) { maxAmount = v.montoEfectivo; dominantMethod = '01'; }
    if (v.montoTarjeta > maxAmount) { maxAmount = v.montoTarjeta; dominantMethod = '28'; }
    if (v.montoTransferencia > maxAmount) { maxAmount = v.montoTransferencia; dominantMethod = '03'; }
    
    if (v.cliente) {
      this.formData = {
        ...this.formData,
        rfc: v.cliente.rfc || '',
        razonSocial: v.cliente.nombreCompleto || '',
        cp: v.cliente.direccion ? (v.cliente.direccion.match(/\b\d{5}\b/) || [''])[0] : '',
        formaPago: dominantMethod,
        regimen: v.cliente.regimenFiscal || '601',
        usoCfdi: v.cliente.usoCfdi || 'G03'
      };
    } else {
      this.formData = { ...this.formData, rfc: '', razonSocial: '', cp: '', formaPago: dominantMethod };
    }
  }

  onFolioInput() {
    this.mostrarDropdownVentas = this.folioVenta().length > 0;
  }
  onFolioFocus() {
    if (this.folioVenta().length > 0) this.mostrarDropdownVentas = true;
  }
  onFolioBlur() { setTimeout(() => this.mostrarDropdownVentas = false, 200); }
  ocultarDropdownVentas() { setTimeout(() => this.mostrarDropdownVentas = false, 200); }

  get clientesFiltrados() {
    if (!this.clienteBuscado) return this.clientesGuardados();
    const query = this.clienteBuscado.toLowerCase();
    return this.clientesGuardados().filter(c => 
      (c.rfc && c.rfc.toLowerCase().includes(query)) || 
      (c.nombreCompleto && c.nombreCompleto.toLowerCase().includes(query))
    );
  }

  onClienteInput() {
    this.mostrarDropdownClientes = true;
    if (!this.clienteBuscado) {
      this.formData.rfc = '';
      this.formData.razonSocial = '';
      this.formData.cp = '';
    }
  }
  onClienteFocus() { this.mostrarDropdownClientes = true; }
  onClienteBlur() { setTimeout(() => this.mostrarDropdownClientes = false, 200); }
  ocultarDropdownClientes() { setTimeout(() => this.mostrarDropdownClientes = false, 200); }

  seleccionarClienteDropdown(cliente: any) {
    this.clienteBuscado = `${cliente.rfc || 'Sin RFC'} - ${cliente.nombreCompleto}`;
    this.mostrarDropdownClientes = false;
    this.aplicarCliente(cliente.idCliente);
  }

  private aplicarCliente(id: number) {
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
          if (res.nombre) this.formData.razonSocial = res.nombre.replace(/\s+/g, ' ').trim();
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

    const payload = {
      idVenta: this.idVenta(),
      receptor: {
        rfc: this.formData.rfc,
        nombre: this.formData.razonSocial,
        usoCfdi: this.formData.usoCfdi,
        regimenFiscal: this.formData.regimen,
        cp: this.formData.cp
      },
      formaPago: this.formData.formaPago,
      metodoPago: this.formData.metodoPago
    };

    this.http.post<any>(`${environment.apiUrl}/pos/facturas/emitir`, payload).subscribe({
      next: (res) => {
        this.facturando.set(false);
        if (res.success) {
          alert('¡Factura emitida correctamente!');
          this.facturaEmitida.emit(res);
          this.cerrarModal();
        } else {
          this.errorFactura.set(res.message || 'Error al emitir factura');
        }
      },
      error: (err) => {
        this.facturando.set(false);
        console.error(err);
        this.errorFactura.set('Error de Facturama: ' + (err.error?.message || err.message || 'Error desconocido'));
      }
    });
  }
}
