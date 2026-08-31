import { environment } from '../../../../environments/environment';
import { Component, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PosService } from '../../../core/services/pos.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { Cliente } from '../../../core/interfaces';

@Component({
  selector: 'app-cliente-rapido',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-rapido.component.html',
})
export class ClienteRapidoComponent {
  cerrar = output<void>();
  clienteCreado = output<Cliente>();

  form: any = { 
    nombreCompleto: '', 
    domicilio: '', 
    telefono: '',
    rfc: '',
    cp: '',
    regimenFiscal: '',
    usoCfdi: 'G03',
    formaPago: '01',
    metodoPago: 'PUE',
    correo: ''
  };
  cargando = signal(false);
  error = signal('');
  subiendoCsf = signal(false);

  private http = inject(HttpClient);
  constructor(private pos: PosService, public toast: ToastService, public confirmService: ConfirmService) {}

  onCsfSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.subiendoCsf.set(true);
    const fd = new FormData();
    fd.append('file', file);

    this.http.post<any>(`${environment.apiUrl}/pos/utils/parse-csf`, fd).subscribe({
      next: async (res) => {
        this.subiendoCsf.set(false);
        if (res.success) {
          if (res.clienteExistente) {
            const cl = res.clienteData;
            // Verificar si ya tiene datos fiscales completos
            if (cl.rfc && cl.cp && cl.regimenFiscal) {
              this.toast.show(`Este cliente ya está registrado y tiene sus datos completos.`, 'info', 4000);
              this.clienteCreado.emit(cl);
              return;
            } else {
              const wantsUpdate = await this.confirmService.confirm({ title: 'Cliente Incompleto', message: `El cliente ya existe, pero sus datos fiscales están incompletos. ¿Deseas actualizarlos?`, confirmText: 'Actualizar', cancelText: 'No' });
                  if (wantsUpdate) {
                this.form = { ...cl, ...res };
                this.form.nombreCompleto = res.nombre || cl.nombreCompleto;
                this.form.domicilio = res.direccion || cl.direccion || cl.domicilio || '';
                if (!this.form.formaPago) this.form.formaPago = '01';
                if (!this.form.metodoPago) this.form.metodoPago = 'PUE';
                if (!this.form.usoCfdi && res.regimenFiscal === '616') this.form.usoCfdi = 'S01';
                else if (!this.form.usoCfdi) this.form.usoCfdi = 'G03';
                this.form.idAModificar = cl.idCliente;
              } else {
                this.clienteCreado.emit(cl);
                return;
              }
            }
          } else {
            this.form.rfc = res.rfc || this.form.rfc;
            this.form.nombreCompleto = res.nombre || this.form.nombreCompleto;
            
            if (res.cp) {
              this.form.cp = res.cp;
            }
            if (res.regimenFiscal) {
              this.form.regimenFiscal = res.regimenFiscal;
              if (res.regimenFiscal === '616') {
                this.form.usoCfdi = 'S01';
              } else {
                this.form.usoCfdi = 'G03';
              }
            }
            this.form.formaPago = '01';
            this.form.metodoPago = 'PUE';
            
            if (res.direccion) {
              this.form.domicilio = res.direccion;
            }
          }
          
        } else {
          this.error.set('Error al leer Cédula: ' + (res.error || 'Formato no reconocido'));
        }
      },
      error: () => {
        this.subiendoCsf.set(false);
        this.error.set('Error conectando al servidor para procesar la Cédula.');
      }
    });
  }

  guardar() {
    if (!this.form.nombreCompleto.trim()) {
      this.error.set('El nombre del cliente es obligatorio.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');

    if (this.form.idAModificar) {
      // Actualizar cliente existente (solo enviar campos válidos)
      const payload = {
        nombreCompleto: this.form.nombreCompleto,
        rfc: this.form.rfc,
        correo: this.form.correo || '',
        telefono: this.form.telefono || '',
        direccion: this.form.domicilio || this.form.direccion || '',
        cp: this.form.cp || '',
        regimenFiscal: this.form.regimenFiscal || '',
        usoCfdi: this.form.usoCfdi || 'G03',
        formaPago: this.form.formaPago || '01',
        metodoPago: this.form.metodoPago || 'PUE'
      };

      this.http.patch<Cliente>(`${environment.apiUrl}/pos/clientes/${this.form.idAModificar}`, payload).subscribe({
        next: (cliente) => {
          this.cargando.set(false);
          this.clienteCreado.emit(cliente);
        },
        error: (err) => {
          this.cargando.set(false);
          const msg = err.error?.message || err.error?.error || 'No se pudo actualizar el cliente. Intenta de nuevo.';
          const finalMsg = Array.isArray(msg) ? msg.join(', ') : msg;
          this.error.set(finalMsg);
        },
      });
    } else {
      // Crear nuevo cliente
      const payloadAlta = {
        nombreCompleto: this.form.nombreCompleto,
        rfc: this.form.rfc,
        correo: this.form.correo || '',
        telefono: this.form.telefono || '',
        direccion: this.form.domicilio || this.form.direccion || '',
        cp: this.form.cp || '',
        regimenFiscal: this.form.regimenFiscal || '',
        usoCfdi: this.form.usoCfdi || 'G03',
        formaPago: this.form.formaPago || '01',
        metodoPago: this.form.metodoPago || 'PUE'
      };
      this.pos.altaRapidaCliente(payloadAlta).subscribe({
        next: (cliente) => {
          this.cargando.set(false);
          this.clienteCreado.emit(cliente);
        },
        error: (err) => {
          this.cargando.set(false);
          const msg = err.error?.message || err.error?.error || 'No se pudo registrar el cliente. Intenta de nuevo.';
          const finalMsg = Array.isArray(msg) ? msg.join(', ') : msg;
          this.error.set(finalMsg);
        },
      });
    }
  }
}
