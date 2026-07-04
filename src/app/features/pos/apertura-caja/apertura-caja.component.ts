import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { PosService } from '../../../core/services/pos.service';

@Component({
  selector: 'app-apertura-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './apertura-caja.component.html',
})
export class AperturaCajaComponent implements OnInit {
  monto: number = 0;
  cargando = signal(false);
  error = signal('');
  nombreCajero = '';

  constructor(
    private auth: AuthService,
    private pos: PosService
  ) {}

  ngOnInit() {
    this.nombreCajero = this.auth.usuario();
    
    const idUsuario = this.auth.sesion()?.idUsuario;
    if (idUsuario) {
      this.cargando.set(true);
      this.pos.getTurnoActivo(idUsuario).subscribe({
        next: (turno) => {
          this.cargando.set(false);
          if (turno) {
            this.auth.marcarTurnoAbierto();
          }
        },
        error: () => this.cargando.set(false)
      });
    }
  }

  abrirTurno() {
    if (this.monto < 0) {
      this.error.set('El monto no puede ser negativo.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');

    this.pos.abrirTurno({ 
      nombre: this.nombreCajero, 
      montoApertura: this.monto,
      idUsuario: this.auth.sesion()?.idUsuario
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.auth.marcarTurnoAbierto();
      },
      error: (err) => {
        this.cargando.set(false);
        if (err.status === 400 && err.error?.message === 'Ya existe un turno abierto para este usuario') {
          this.auth.marcarTurnoAbierto();
        } else {
          this.error.set('No se pudo registrar la apertura. Intenta de nuevo.');
        }
      },
    });
  }
}
