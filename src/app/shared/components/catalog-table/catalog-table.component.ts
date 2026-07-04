import { Component, input, output, signal, computed, ElementRef, ViewChild, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface CatalogTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  type?: 'text' | 'number' | 'date' | 'badge' | 'button';
  badgeColors?: { [key: string]: string };
  format?: (value: any) => string;
  action?: (row: any) => void;
  icon?: string; // Optional icon for button
  buttonText?: string; // Optional text for button override
  hideOnMobile?: boolean; // Hide this column on small screens
  width?: string; // Specific width (e.g. '1px', '50px', 'w-1')
  maxWidth?: string; // Max width for column (e.g., '200px', '15rem')
  iconOnly?: boolean; // If true, hides the text and only shows icon
  buttonStyle?: 'standard' | 'circle';
}

export interface CatalogTableAction {
  label: string;
  icon?: string;
  color: 'primary' | 'danger' | 'success';
  visible?: (row: any) => boolean;
  onClick: (row: any) => void;
}

@Component({
  selector: 'app-catalog-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: {
    '(window:resize)': 'onResize()',
    '(window:scroll)': 'onScroll()'
  },
  template: `
    <!-- Contenedor general adaptado al estilo Enterprise (Fondo blanco, sin bordes fuertes, redondeo moderado) -->
    <div class="flex flex-col h-full bg-transparent w-full">
      
      <!-- Contenedor Principal (Tabla + Paginación) -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col w-full">
          
        <!-- Búsqueda Integrada (Top) -->
        <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div class="relative w-full sm:w-80">
            @if (searchable()) {
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                [(ngModel)]="searchTerm"
                (ngModelChange)="onSearch()"
                placeholder="Buscar..."
                class="pl-9 w-full bg-white border border-gray-200 rounded-lg py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-500 shadow-sm transition-colors"
              />
            } @else {
              <ng-content select="[header-search]"></ng-content>
            }
          </div>
          <!-- Acciones extra (Derecha superior) -->
          <div class="flex items-center gap-2">
              <ng-content select="[header-actions]"></ng-content>
          </div>
        </div>

        <div class="flex-1 overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="sticky top-0 z-10">
              <tr class="bg-amber-500 text-white">
                @for (column of columns(); track column.key) {
                  <th 
                    [ngClass]="column.hideOnMobile ? 'py-3 px-6 text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-amber-700 transition-colors select-none hidden md:table-cell' : 'py-3 px-6 text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-amber-700 transition-colors select-none'"
                    [class]="column.width || ''"
                    (click)="column.sortable !== false ? onSort(column.key) : null"
                  >
                    <div class="flex items-center gap-1.5 group">
                      {{ column.label }}
                      @if (column.sortable !== false) {
                        <span class="text-white/70 group-hover:text-white transition-colors">
                          @if (sortColumn() === column.key) {
                              @if (sortDirection() === 'asc') {
                                  <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" /></svg>
                              } @else {
                                  <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                              }
                          } @else {
                               <svg class="w-3 h-3 opacity-0 group-hover:opacity-100" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                          }
                        </span>
                      }
                    </div>
                  </th>
                }
                @if (actions() && actions()!.length > 0) {
                  <th class="py-3 px-6 text-xs font-bold uppercase tracking-widest text-center sticky right-0 bg-amber-500 w-32">
                    Acciones
                  </th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @if (loading()) {
                <tr>
                  <td [attr.colspan]="columns().length + (actions()?.length ? 1 : 0)" class="py-12 text-center w-full">
                    <div class="flex justify-center w-full">
                      <div class="animate-spin rounded-full h-8 w-8 border-4 border-amber-200 border-t-amber-500"></div>
                    </div>
                  </td>
                </tr>
              } @else if (paginatedData().length === 0) {
                <tr>
                  <td [attr.colspan]="columns().length + (actions()?.length ? 1 : 0)" class="py-12 text-center text-gray-400 w-full">
                    No se encontraron resultados
                  </td>
                </tr>
              } @else {
                @for (row of paginatedData(); track row) {
                  <tr class="hover:bg-gray-50 transition-colors group/row">
                    @for (column of columns(); track column.key) {
                      <td [ngClass]="column.hideOnMobile ? 'py-3 px-6 hidden md:table-cell' : 'py-3 px-6'" 
                          [style.maxWidth]="column.maxWidth || 'auto'"
                          [class]="column.width || ''">
                        @if (column.type === 'badge') {
                          @let rawValue = getNestedValue(row, column.key);
                          @let displayValue = column.format ? column.format(rawValue) : rawValue;
                          <span [class]="'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ' + getBadgeColor(displayValue, column.badgeColors)">
                            {{ displayValue }}
                          </span>
                        } @else if (column.type === 'button') {
                          <button 
                            (click)="$event.stopPropagation(); column.action && column.action(row)"
                            [class]="column.buttonStyle === 'circle' 
                              ? 'flex items-center justify-center w-8 h-8 text-amber-500 hover:bg-amber-50 rounded-full transition-colors'
                              : 'text-amber-500 hover:text-gray-900 font-bold text-sm bg-amber-50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors'"
                          >
                              @if (column.icon) {
                                <span [innerHTML]="getSafeHtml(column.icon)"></span>
                              }
                              @if (!column.iconOnly) {
                                {{ column.buttonText ?? (column.format ? column.format(getNestedValue(row, column.key)) : getNestedValue(row, column.key)) ?? 'Ver' }}
                              }
                          </button>
                        } @else {
                          @if (column.format) {
                            <span class="text-sm font-bold text-gray-900 block truncate" [innerHTML]="column.format(getNestedValue(row, column.key))"></span>
                          } @else {
                            <span class="text-sm font-bold text-gray-900 block truncate" [title]="getNestedValue(row, column.key)">{{ getNestedValue(row, column.key) }}</span>
                          }
                        }
                      </td>
                    }

                    @if (actions() && actions()!.length > 0) {
                      <td class="py-3 px-6 text-center whitespace-nowrap sticky right-0 bg-white group-hover/row:bg-gray-50 transition-colors z-10 w-32 flex justify-center gap-2">
                        @for (action of actions(); track action.label) {
                          <button
                            (click)="handleActionClick(action, row)"
                            class="text-gray-400 transition-colors"
                            [class.hover:text-amber-500]="action.color === 'primary'"
                            [class.hover:text-emerald-600]="action.color === 'success'"
                            [class.hover:text-rose-600]="action.color === 'danger'"
                            [title]="action.label"
                          >
                            @if (action.icon) {
                              <span [innerHTML]="getSafeHtml(action.icon)"></span>
                            } @else {
                              <!-- Default Icons if none provided -->
                              @if (action.color === 'primary') {
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" /></svg>
                              } @else if (action.color === 'success') {
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                              } @else if (action.color === 'danger') {
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                              }
                            }
                          </button>
                        }
                      </td>
                    }
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Paginator adaptado -->
        @if (totalPages() > 1) {
          <div class="bg-gray-50 p-3 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 font-bold uppercase tracking-widest gap-4">
            
            <div class="flex items-center gap-2">
               <span>Ir a pág.</span>
               <input 
                  type="number" 
                  [min]="1" 
                  [max]="totalPages()"
                  [value]="currentPage()"
                  (change)="onPageInput($event)"
                  class="bg-white w-12 border border-gray-200 text-gray-900 rounded py-1 px-2 text-center outline-none focus:border-amber-500 transition-colors"
               />
               <span>de {{ totalPages() }}</span>
            </div>
            
            <nav class="flex items-center space-x-1">
               <ul class="flex items-center -space-x-px text-sm">
                  <li>
                    <button 
                      (click)="previousPage()" 
                      [disabled]="currentPage() === 1"
                      class="flex items-center justify-center h-8 px-3 text-gray-500 bg-white border border-gray-200 rounded-s-lg hover:bg-amber-50 hover:text-amber-500 disabled:opacity-50 transition-colors"
                    >
                      Anterior
                    </button>
                  </li>
                  
                  @for (page of visiblePages(); track page) {
                     <li>
                        @if (page === -1) {
                          <span class="flex items-center justify-center h-8 px-3 text-gray-500 bg-white border border-gray-200">...</span>
                        } @else {
                          <button 
                              (click)="goToPage(page)"
                              [class]="page === currentPage() 
                                  ? 'flex items-center justify-center h-8 w-8 text-white border border-amber-500 bg-amber-500 font-bold' 
                                  : 'flex items-center justify-center h-8 w-8 text-gray-500 bg-white border border-gray-200 hover:bg-amber-50 hover:text-amber-500 font-bold'"
                          >
                              {{ page }}
                          </button>
                        }
                     </li>
                  }

                  <li>
                    <button 
                      (click)="nextPage()" 
                      [disabled]="currentPage() === totalPages()"
                      class="flex items-center justify-center h-8 px-3 text-gray-500 bg-white border border-gray-200 rounded-e-lg hover:bg-amber-50 hover:text-amber-500 disabled:opacity-50 transition-colors"
                    >
                      Siguiente
                    </button>
                  </li>
               </ul>
            </nav>

          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class CatalogTableComponent {
  // Inputs
  title = input<string>('');
  data = input<any[]>([]);
  columns = input.required<CatalogTableColumn[]>();
  actions = input<CatalogTableAction[]>();
  searchable = input<boolean>(true);
  loading = input<boolean>(false);
  pageSize = input<number>(10);

  // State
  searchTerm = signal('');
  sortColumn = signal<string>('');
  sortDirection = signal<'asc' | 'desc'>('asc');
  currentPage = signal(1);
  activeMenuRow = signal<any | null>(null);
  menuPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 });

  private sanitizer = inject(DomSanitizer);

  constructor() {
    effect(() => {
      const total = this.totalPages();
      const current = this.currentPage();
      if (total > 0 && current > total) {
        this.currentPage.set(1);
      }
    });
  }

  Math = Math;

  getSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  onResize() {
    if (this.activeMenuRow()) {
      this.closeMenu();
    }
  }

  onScroll() {
    if (this.activeMenuRow()) {
      this.closeMenu();
    }
  }

  // Computed
  filteredData = computed(() => {
    let result = this.data();
    const search = this.searchTerm().toLowerCase();

    if (search) {
      result = result.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(search)
        )
      );
    }

    if (this.sortColumn()) {
      result = [...result].sort((a, b) => {
        const aVal = a[this.sortColumn()];
        const bVal = b[this.sortColumn()];
        const modifier = this.sortDirection() === 'asc' ? 1 : -1;

        if (aVal < bVal) return -1 * modifier;
        if (aVal > bVal) return 1 * modifier;
        return 0;
      });
    }

    return result;
  });

  totalPages = computed(() =>
    Math.ceil(this.filteredData().length / this.pageSize())
  );

  paginatedData = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return this.filteredData().slice(start, end);
  });

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    pages.push(1);

    let start = Math.max(2, current - 1);
    let end = Math.min(total - 1, current + 1);

    if (current <= 3) {
      end = Math.min(total - 1, 4);
    }
    if (current >= total - 2) {
      start = Math.max(2, total - 3);
    }

    if (start > 2) {
      pages.push(-1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < total - 1) {
      pages.push(-1);
    }

    if (total > 1) {
      pages.push(total);
    }

    return pages;
  });

  onSearch(): void {
    this.currentPage.set(1);
  }

  onSort(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
  }

  onPageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = parseInt(input.value, 10);

    if (isNaN(val)) val = 1;
    if (val < 1) val = 1;
    if (val > this.totalPages()) val = this.totalPages();

    this.currentPage.set(val);
    input.value = val.toString();
  }

  getBadgeColor(value: any, colors?: { [key: string]: string }): string {
    if (colors && colors[value]) {
      return colors[value];
    }
    const stringValue = String(value).toLowerCase();

    // Estilo Enterprise para etiquetas
    if (['activo', 'completado', 'aprobado', 'exitoso', 'pagado', '1', 'true', 'yes', 'si', 'ingreso', 'entrada'].includes(stringValue)) {
      return 'text-emerald-700 bg-emerald-50 border border-emerald-100';
    }
    if (['inactivo', 'cancelado', 'rechazado', 'error', 'fallido', '0', 'false', 'no', 'salida', 'egreso'].includes(stringValue)) {
      return 'text-rose-700 bg-rose-50 border border-rose-100';
    }
    if (['pendiente', 'en espera', 'procesando', 'warning'].includes(stringValue)) {
      return 'text-amber-700 bg-amber-50 border border-amber-100';
    }
    if (['en progreso', 'en curso', 'programado'].includes(stringValue)) {
      return 'text-amber-700 bg-amber-50 border border-amber-100';
    }
    return 'text-gray-700 bg-gray-50 border border-gray-200';
  }

  toggleMenu(row: any, event: MouseEvent, button: HTMLElement): void {
    event.stopPropagation();
    if (this.activeMenuRow() === row) {
      this.closeMenu();
      return;
    }
    const rect = button.getBoundingClientRect();
    let x = rect.left - 140 + rect.width + 10;
    let y = rect.bottom + 5;
    if (x < 10) x = rect.left;
    this.menuPosition.set({ x, y });
    this.activeMenuRow.set(row);
  }

  closeMenu(): void {
    this.activeMenuRow.set(null);
  }

  handleActionClick(action: CatalogTableAction, row: any): void {
    this.closeMenu();
    action.onClick(row);
  }

  getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }
}
