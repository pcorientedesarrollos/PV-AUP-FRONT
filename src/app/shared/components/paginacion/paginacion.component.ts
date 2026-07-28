import { Component, Input, Output, EventEmitter, computed, signal, effect, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-paginacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paginacion.component.html'
})
export class PaginacionComponent implements OnChanges {
  @Input() paginaActual: number = 1;
  @Input() totalPaginas: number = 1;
  @Input() totalRegistros: number = 0;
  @Input() tamanoPagina: number = 50;

  @Output() paginaCambiada = new EventEmitter<number>();

  paginasMostradas = computed(() => {
    const paginas = [];
    const total = this.totalPaginas;
    const actual = this.paginaActual;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        paginas.push(i);
      }
    } else {
      if (actual <= 3) {
        paginas.push(1, 2, 3, 4, '...', total);
      } else if (actual >= total - 2) {
        paginas.push(1, '...', total - 3, total - 2, total - 1, total);
      } else {
        paginas.push(1, '...', actual - 1, actual, actual + 1, '...', total);
      }
    }
    return paginas;
  });

  rangoInicio = computed(() => {
    if (this.totalRegistros === 0) return 0;
    return (this.paginaActual - 1) * this.tamanoPagina + 1;
  });

  rangoFin = computed(() => {
    return Math.min(this.paginaActual * this.tamanoPagina, this.totalRegistros);
  });

  ngOnChanges(changes: SimpleChanges): void {
    // Validar que la pagina actual no sea mayor al total (sucede al filtrar)
    if (this.totalPaginas > 0 && this.paginaActual > this.totalPaginas) {
      this.cambiarPagina(1);
    }
  }

  cambiarPagina(pagina: number | string) {
    if (typeof pagina === 'number' && pagina >= 1 && pagina <= this.totalPaginas && pagina !== this.paginaActual) {
      this.paginaCambiada.emit(pagina);
    }
  }
}
