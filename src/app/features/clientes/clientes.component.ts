import { Component, signal, computed, OnInit, effect, inject } from '@angular/core';
import { ExportService } from '../../core/services/export.service';
import { PaginacionComponent } from '../../shared/components/paginacion/paginacion.component';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';


@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginacionComponent],
  templateUrl: './clientes.component.html',
})
export class ClientesComponent implements OnInit {
  toast = inject(ToastService);
  // Estado Principal
  clientesOriginales = signal<any[]>([]);
  clientesUnicos = signal<any[]>([]);
  cargando = signal(true);
  mostrarImportar = signal(false);
  
  // Búsqueda y Filtros
  busqueda = signal('');
  filtroEstado = signal<'todos' | 'activos' | 'inactivos'>('todos');
  filtroEmpresa = signal<number | 'todas'>('todas');
  filtroSucursal = signal<number | 'todas'>('todas');
  
  empresas = signal<any[]>([]);
  sucursales = signal<any[]>([]);
  
  isSoporte = computed(() => this.auth.sesion()?.idPerfil === 3);

  sucursalesFiltradas = computed(() => {
    const fEmpresa = this.filtroEmpresa();
    if (fEmpresa === 'todas') return this.sucursales();
    return this.sucursales().filter(s => s.empresa?.idEmpresa === fEmpresa);
  });

  clientesFiltrados = computed(() => {
    let list = this.clientesUnicos();
    
    // Filtrar por estado
    const estado = this.filtroEstado();
    if (estado === 'activos') list = list.filter(c => c.estado === 1);
    if (estado === 'inactivos') list = list.filter(c => c.estado === 0);

    const fEmpresa = this.filtroEmpresa();
    if (fEmpresa !== 'todas') {
      list = list.filter(c => c.sucursal?.empresa?.idEmpresa === fEmpresa);
    }
    
    const fSucursal = this.filtroSucursal();
    if (fSucursal !== 'todas') {
      list = list.filter(c => c.sucursal?.idSucursal === fSucursal);
    }

    const term = this.busqueda().toLowerCase();
      if (!term) return list;
      
      return list.filter(c => 
        (c.idCliente && c.idCliente.toString().includes(term)) ||
        (c.nombre && c.nombre.toLowerCase().includes(term)) || 
        (c.rfc && c.rfc.toLowerCase().includes(term)) ||
        (c.correo && c.correo.toLowerCase().includes(term)) ||
        (c.domicilio && c.domicilio.toLowerCase().includes(term)) ||
        (c.telefono && c.telefono.includes(term)) ||
        (c.regimenFiscal && c.regimenFiscal.toLowerCase().includes(term)) ||
        (c.usoCfdi && c.usoCfdi.toLowerCase().includes(term)) ||
        (c.formaPago && c.formaPago.toLowerCase().includes(term)) ||
        (c.metodoPago && c.metodoPago.toLowerCase().includes(term))
      );
    });

  // --- PAGINACIÓN ---
  paginaActual = signal(1);
  tamanoPagina = signal(10);
  
  totalPaginas = computed(() => {
    return Math.max(1, Math.ceil(this.clientesFiltrados().length / this.tamanoPagina()));
  });

  clientesPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.tamanoPagina();
    const fin = inicio + this.tamanoPagina();
    return this.clientesFiltrados().slice(inicio, fin);
  });

  constructor(private http: HttpClient, private router: Router, public auth: AuthService, public exportService: ExportService) {
    // Resetear a página 1 cuando cambia algún filtro
    effect(() => {
      this.busqueda();
      this.filtroEstado();
      this.filtroEmpresa();
      this.filtroSucursal();
      this.paginaActual.set(1);
    });
  }

  // Modal
  mostrarModal = signal(false);
  modoModal = signal<'crear' | 'editar'>('crear');
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
          this.clienteActual.rfc = res.rfc || this.clienteActual.rfc;
          this.clienteActual.nombre = res.nombre || this.clienteActual.nombre;
          
          if (res.cp) {
            this.clienteActual.cp = res.cp;
          }
          if (res.regimenFiscal) {
            this.clienteActual.regimenFiscal = res.regimenFiscal;
            if (res.regimenFiscal === '616') {
              this.clienteActual.usoCfdi = 'S01';
            } else {
              this.clienteActual.usoCfdi = 'G03';
            }
          }
          this.clienteActual.formaPago = '01';
          this.clienteActual.metodoPago = 'PUE';
          
          if (res.direccion) {
            this.clienteActual.domicilio = res.direccion;
          }
          
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



  coincidenciasNombre(): any[] {
    if (!this.clienteActual?.nombre || this.clienteActual.nombre.trim().length < 2) return [];
    const term = this.clienteActual.nombre.toLowerCase().trim();
    return this.clientesOriginales().filter((c: any) => c.nombre?.toLowerCase().includes(term) && c.idCliente !== this.clienteActual.idCliente).slice(0, 5);
  }

  coincidenciasRfc(): any[] {
    if (!this.clienteActual?.rfc || this.clienteActual.rfc.trim().length < 2) return [];
    const term = this.clienteActual.rfc.toLowerCase().trim();
    return this.clientesOriginales().filter((c: any) => c.rfc?.toLowerCase().includes(term) && c.idCliente !== this.clienteActual.idCliente).slice(0, 5);
  }

  get duplicadoNombre(): boolean {
    if (!this.clienteActual?.nombre) return false;
    const nombre = this.clienteActual.nombre.toLowerCase().trim();
    return this.clientesOriginales().some(c => c.nombre?.toLowerCase().trim() === nombre && c.idCliente !== this.clienteActual.idCliente);
  }
  
  get duplicadoRfc(): boolean {
    if (!this.clienteActual?.rfc) return false;
    const rfc = this.clienteActual.rfc.toLowerCase().trim();
    return this.clientesOriginales().some(c => c.rfc?.toLowerCase().trim() === rfc && c.idCliente !== this.clienteActual.idCliente);
  }

  clienteOriginal: any = null;

  clienteActual = {
    idCliente: 0,
    nombre: '',
    telefono: '',
    domicilio: '',
    correo: '',
    rfc: '',
    cp: '',
    regimenFiscal: '601',
    usoCfdi: 'G03',
    formaPago: '01',
    metodoPago: 'PUE'
  };



  isAdmin(): boolean {
    return this.auth.sesion()?.idPerfil === 1 || this.auth.sesion()?.idPerfil === 3;
  }

  navegar(ruta: string) {
    this.router.navigate([ruta]);
  }

  ngOnInit() {
    this.cargarClientes();
    if (this.isSoporte()) {
      this.http.get<any[]>(`${environment.apiUrl}/pos/empresas`).subscribe(res => this.empresas.set(res));
      this.http.get<any[]>(`${environment.apiUrl}/pos/sucursales`).subscribe(res => this.sucursales.set(res));
    }
  }

  cargarClientes() {
    this.cargando.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/pos/clientes?limit=10000`).subscribe({
      next: (res: any) => {
        const data = res.data || res;
        const mapeados = data.map((c: any) => ({
          idCliente: c.idCliente,
          nombre: c.nombreCompleto,
          telefono: c.telefono,
          domicilio: c.direccion,
          correo: c.correo,
          rfc: c.rfc,
          cp: c.cp,
          regimenFiscal: c.regimenFiscal,
          usoCfdi: c.usoCfdi,
          formaPago: c.formaPago,
          metodoPago: c.metodoPago,
          estado: 1, // No status column in DB yet, default to active
          sucursal: c.sucursal
        }));
        this.clientesOriginales.set(mapeados);
        this.aplicarFiltroMagico(mapeados);
        this.cargando.set(false);
      },
      error: (err) => {
        (function(...args: any[]){})('Error al cargar clientes', err);
        this.cargando.set(false);
      }
    });
  }

  regimenes = [
    { id: '601', nombre: 'General de Ley Personas Morales' },
    { id: '603', nombre: 'Personas Morales con Fines no Lucrativos' },
    { id: '605', nombre: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
    { id: '606', nombre: 'Arrendamiento' },
    { id: '607', nombre: 'Régimen de Enajenación o Adquisición de Bienes' },
    { id: '608', nombre: 'Demás ingresos' },
    { id: '610', nombre: 'Residentes en el Extranjero sin Establecimiento Permanente' },
    { id: '611', nombre: 'Ingresos por Dividendos (socios y accionistas)' },
    { id: '612', nombre: 'Personas Físicas con Actividades Empresariales y Profesionales' },
    { id: '614', nombre: 'Ingresos por intereses' },
    { id: '615', nombre: 'Régimen de los ingresos por obtención de premios' },
    { id: '616', nombre: 'Sin obligaciones fiscales' },
    { id: '620', nombre: 'Sociedades Cooperativas de Producción' },
    { id: '621', nombre: 'Incorporación Fiscal' },
    { id: '622', nombre: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
    { id: '623', nombre: 'Opcional para Grupos de Sociedades' },
    { id: '624', nombre: 'Coordinados' },
    { id: '625', nombre: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
    { id: '626', nombre: 'Régimen Simplificado de Confianza' }
  ];

  usos = [
    { id: 'G01', nombre: 'Adquisición de mercancias' },
    { id: 'G02', nombre: 'Devoluciones, descuentos o bonificaciones' },
    { id: 'G03', nombre: 'Gastos en general' },
    { id: 'I01', nombre: 'Construcciones' },
    { id: 'I02', nombre: 'Mobiliario y equipo de oficina por inversiones' },
    { id: 'I03', nombre: 'Equipo de transporte' },
    { id: 'I04', nombre: 'Equipo de computo y accesorios' },
    { id: 'I05', nombre: 'Dados, troqueles, moldes, matrices y herramental' },
    { id: 'I06', nombre: 'Comunicaciones telefónicas' },
    { id: 'I07', nombre: 'Comunicaciones satelitales' },
    { id: 'I08', nombre: 'Otra maquinaria y equipo' },
    { id: 'D01', nombre: 'Honorarios médicos, dentales y gastos hospitalarios.' },
    { id: 'D02', nombre: 'Gastos médicos por incapacidad o discapacidad' },
    { id: 'D03', nombre: 'Gastos funerales.' },
    { id: 'D04', nombre: 'Donativos.' },
    { id: 'D05', nombre: 'Intereses reales efectivamente pagados por créditos hipotecarios.' },
    { id: 'D06', nombre: 'Aportaciones voluntarias al SAR.' },
    { id: 'D07', nombre: 'Primas por seguros de gastos médicos.' },
    { id: 'D08', nombre: 'Gastos de transportación escolar obligatoria.' },
    { id: 'D09', nombre: 'Depósitos en cuentas para el ahorro, primas para pensiones.' },
    { id: 'D10', nombre: 'Pagos por servicios educativos (colegiaturas)' },
    { id: 'S01', nombre: 'Sin efectos fiscales' },
    { id: 'CP01', nombre: 'Pagos' },
    { id: 'CN01', nombre: 'Nómina' }
  ];

  formasPago = [
    { id: '01', nombre: 'Efectivo' },
    { id: '02', nombre: 'Cheque nominativo' },
    { id: '03', nombre: 'Transferencia electrónica de fondos' },
    { id: '04', nombre: 'Tarjeta de crédito' },
    { id: '05', nombre: 'Monedero electrónico' },
    { id: '06', nombre: 'Dinero electrónico' },
    { id: '08', nombre: 'Vales de despensa' },
    { id: '12', nombre: 'Dación en pago' },
    { id: '13', nombre: 'Pago por subrogación' },
    { id: '14', nombre: 'Pago por consignación' },
    { id: '15', nombre: 'Condonación' },
    { id: '17', nombre: 'Compensación' },
    { id: '23', nombre: 'Novación' },
    { id: '24', nombre: 'Confusión' },
    { id: '25', nombre: 'Remisión de deuda' },
    { id: '26', nombre: 'Prescripción o caducidad' },
    { id: '27', nombre: 'A satisfacción del acreedor' },
    { id: '28', nombre: 'Tarjeta de débito' },
    { id: '29', nombre: 'Tarjeta de servicios' },
    { id: '30', nombre: 'Aplicación de anticipos' },
    { id: '31', nombre: 'Intermediario pagos' },
    { id: '99', nombre: 'Por definir' }
  ];

  metodosPago = [
    { id: 'PUE', nombre: 'Pago en una sola exhibición' },
    { id: 'PPD', nombre: 'Pago en parcialidades o diferido' }
  ];

  // --- EL FILTRO MÁGICO ---
  // Agrupa clientes por nombre exacto, dejando solo 1 registro por nombre
  aplicarFiltroMagico(data: any[]) {
    const unicos = [];
    const nombresVistos = new Set<string>();

    for (const c of data) {
      if (!c.nombre) continue; // Si no tiene nombre, ignorarlo o manejarlo
      const nombreLimpio = c.nombre.trim().toUpperCase();
      if (!nombresVistos.has(nombreLimpio)) {
        unicos.push(c);
        nombresVistos.add(nombreLimpio);
      }
    }
    this.clientesUnicos.set(unicos);
  }

  // --- ACCIONES CRUD ---

  abrirModalCrear() {
    this.modoModal.set('crear');
    this.clienteActual = { idCliente: 0, nombre: '', telefono: '', domicilio: '', correo: '', rfc: '', cp: '', regimenFiscal: '601', usoCfdi: 'G03', formaPago: '01', metodoPago: 'PUE' };
    this.clienteOriginal = JSON.parse(JSON.stringify(this.clienteActual));
    this.mostrarModal.set(true);
  }

  abrirModalEditar(cliente: any) {
    this.modoModal.set('editar');
    this.clienteActual = { 
      idCliente: cliente.idCliente,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      domicilio: cliente.domicilio,
      correo: cliente.correo,
      rfc: cliente.rfc,
      cp: cliente.cp || '',
      regimenFiscal: cliente.regimenFiscal || '601',
      usoCfdi: cliente.usoCfdi || 'G03',
      formaPago: cliente.formaPago || '01',
      metodoPago: cliente.metodoPago || 'PUE'
    };
    this.mostrarModal.set(true);
  }

  cerrarModal(forzar = false) {
    if (!forzar && this.clienteOriginal && this.mostrarModal()) {
      if (JSON.stringify(this.clienteActual) !== JSON.stringify(this.clienteOriginal)) {
        if (!confirm('¿Estás seguro que deseas salir? Tienes cambios sin guardar.')) {
          return;
        }
      }
    }
    this.mostrarModal.set(false);
  }

  guardarCliente() {
    if (!this.clienteActual.nombre.trim()) {
      this.toast.show('El nombre del cliente es obligatorio', 'warning');
      return;
    }

    // Validar duplicados
    const rfc = this.clienteActual.rfc?.trim().toLowerCase();
    const nombre = this.clienteActual.nombre?.trim().toLowerCase();
    const duplicado = this.clientesOriginales().find((c: any) => 
      c.idCliente !== this.clienteActual.idCliente && 
      ((rfc && c.rfc?.trim().toLowerCase() === rfc) || 
       (nombre && c.nombre?.trim().toLowerCase() === nombre))
    );
    if (duplicado) {
      this.toast.show(`Ya existe un cliente activo con este Nombre o RFC (${duplicado.nombre}).`, 'error');
      return;
    }

    // Backend endpoint expected payloads
    const payload = {
      nombreCompleto: this.clienteActual.nombre,
      telefono: this.clienteActual.telefono,
      direccion: this.clienteActual.domicilio,
      correo: this.clienteActual.correo,
      rfc: this.clienteActual.rfc,
      cp: this.clienteActual.cp,
      regimenFiscal: this.clienteActual.regimenFiscal,
      usoCfdi: this.clienteActual.usoCfdi,
      formaPago: this.clienteActual.formaPago,
      metodoPago: this.clienteActual.metodoPago
    };

    if (this.modoModal() === 'crear') {
      this.http.post(`${environment.apiUrl}/pos/clientes/alta-rapida`, payload).subscribe({
        next: () => {
          this.toast.show('Cliente registrado con éxito', 'success');
          this.cerrarModal(true);
          this.cargarClientes();
        },
        error: (err: HttpErrorResponse) => {
          if (err.error?.message) {
            this.toast.show(err.error.message, 'error');
          } else {
            this.toast.show('Error al crear el cliente. Verifica duplicados.', 'error');
          }
        }
      });
    } else {
      this.http.patch(`${environment.apiUrl}/pos/clientes/${this.clienteActual.idCliente}`, payload).subscribe({
        next: () => {
          this.toast.show('Cliente actualizado con éxito', 'success');
          this.cerrarModal(true);
          this.cargarClientes();
        },
        error: (err: HttpErrorResponse) => {
          if (err.error?.message) {
            this.toast.show(err.error.message, 'error');
          } else {
            this.toast.show('Error al editar el cliente.', 'error');
          }
        }
      });
    }
  }

  eliminarCliente(id: number) {
    if (confirm('¿Estás seguro de que deseas desactivar este cliente?')) {
      this.http.delete(`${environment.apiUrl}/pos/clientes/${id}`).subscribe({
        next: () => this.cargarClientes(),
        error: (err) => {
          (function(...args: any[]){})('Error desactivando', err);
          alert('No se pudo desactivar el cliente.');
        }
      });
    }
  }

  getNombreFormaPago(codigo: string): string {
    const formas: Record<string, string> = {
      '01': '01 - Efectivo',
      '02': '02 - Cheque nominativo',
      '03': '03 - Transferencia electrónica de fondos',
      '04': '04 - Tarjeta de crédito',
      '28': '28 - Tarjeta de débito',
      '99': '99 - Por definir'
    };
    return formas[codigo] || codigo;
  }

  getNombreUsoCfdi(codigo: string): string {
    const usos: Record<string, string> = {
      'G01': 'G01 - Adquisición de mercancías',
      'G03': 'G03 - Gastos en general',
      'S01': 'S01 - Sin efectos fiscales',
      'P01': 'P01 - Por definir'
    };
    return usos[codigo] || codigo;
  }

  exportarExcel() {
    const data = this.clientesFiltrados().map((c: any) => ({
      'Nombre': c.nombre,
      'RFC': c.rfc || 'N/A',
      'Teléfono': c.telefono || 'N/A',
      'Email': c.correo || 'N/A',
      'Régimen Fiscal': c.regimenFiscal || 'N/A'
    }));
    this.exportService.exportToExcel(data, 'Clientes');
  }

  exportarPDF() {
    const headers = ['Nombre', 'RFC', 'Teléfono', 'Email', 'Régimen'];
    const data = this.clientesFiltrados().map((c: any) => [
      c.nombre,
      c.rfc || 'N/A',
      c.telefono || 'N/A',
      c.correo || 'N/A',
      c.regimenFiscal || 'N/A'
    ]);
    this.exportService.exportToPdf(headers, data, 'Catálogo de Clientes', 'Clientes', 'p');
  }
}
