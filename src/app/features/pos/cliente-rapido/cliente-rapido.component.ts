import { Component, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PosService } from '../../../core/services/pos.service';
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
  constructor(private pos: PosService) {}

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

    this.pos.altaRapidaCliente(this.form).subscribe({
      next: (cliente) => {
        this.cargando.set(false);
        this.clienteCreado.emit(cliente);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo registrar el cliente. Intenta de nuevo.');
      },
    });
  }
}
