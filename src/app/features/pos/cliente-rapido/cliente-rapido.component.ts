import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  form = { nombreCompleto: '', domicilio: '', telefono: '' };
  cargando = signal(false);
  error = signal('');

  constructor(private pos: PosService) {}

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
