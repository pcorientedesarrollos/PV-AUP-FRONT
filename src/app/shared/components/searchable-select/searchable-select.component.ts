import { Component, Input, Output, EventEmitter, signal, computed, ElementRef, HostListener, ViewChild, forwardRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="relative w-full text-sm">
      <div 
        class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white flex justify-between items-center cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500"
        (click)="toggleOpen()">
        <span class="truncate text-slate-700" [class.text-slate-400]="!selectedValue()">
          {{ displayValue() || placeholder }}
        </span>
        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>

      @if (isOpen()) {
        <div class="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60">
          <div class="p-2 border-b border-slate-100 bg-slate-50 sticky top-0">
            <input 
              #searchInput
              type="text" 
              [(ngModel)]="searchText"
              (input)="onSearch($event)"
              placeholder="Buscar producto..."
              class="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              (click)="$event.stopPropagation()">
          </div>
          <div class="overflow-y-auto">
            @if (filteredOptions().length === 0) {
              <div class="px-4 py-3 text-slate-500 text-center text-xs">No se encontraron resultados</div>
            }
            @for (opt of filteredOptions(); track opt[bindValue]) {
              <div 
                class="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 transition-colors"
                [class.bg-indigo-50]="opt[bindValue] === selectedValue()"
                [class.font-semibold]="opt[bindValue] === selectedValue()"
                (click)="selectOption(opt, $event)">
                {{ opt[bindLabel] }}
                @if (opt.stockActual !== undefined) {
                  <span class="text-xs text-slate-400 ml-1 truncate">(Stock: {{ opt.stockActual }} {{ opt.unidadMedida || 'Pza' }})</span>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class SearchableSelectComponent implements ControlValueAccessor, OnChanges {
  @Input() options: any[] = [];
  private _options = signal<any[]>([]);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['options']) {
      this._options.set(this.options || []);
    }
  }

  @Input() bindLabel: string = 'nombre';
  @Input() bindValue: string = 'id';
  @Input() placeholder: string = 'Seleccione...';
  
  @Output() change = new EventEmitter<any>();
  @ViewChild('searchInput') searchInput!: ElementRef;

  isOpen = signal(false);
  searchText = signal('');
  selectedValue = signal<any>(null);

  // ControlValueAccessor callbacks
  onChange = (val: any) => {};
  onTouched = () => {};

  writeValue(val: any): void {
    this.selectedValue.set(val);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Optional implementation if needed
  }

  filteredOptions = computed(() => {
    const search = this.searchText().toLowerCase();
    const opts = this._options();
    if (!search) return opts;
    return opts.filter(opt => 
      String(opt[this.bindLabel] || '').toLowerCase().includes(search)
    );
  });

  displayValue = computed(() => {
    const val = this.selectedValue();
    if (val === null || val === undefined) return '';
    const opts = this._options();
    
    // Type coercion in case bindValue is string and val is number or vice-versa
    const found = opts.find(o => String(o[this.bindValue]) === String(val));
    if (!found) return '';
    
    // Custom display for products
    let display = found[this.bindLabel];
    if (found.stockActual !== undefined) {
      display += ` (Stock: ${found.stockActual} ${found.unidadMedida || 'Pza'})`;
    }
    return display;
  });

  constructor(private eRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
      this.searchText.set('');
    }
  }

  toggleOpen() {
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.searchText.set('');
      setTimeout(() => {
        if (this.searchInput) {
          this.searchInput.nativeElement.focus();
        }
      }, 50);
    }
  }

  onSearch(event: any) {
    this.searchText.set(event.target.value);
  }

  selectOption(opt: any, event: Event) {
    event.stopPropagation();
    this.selectedValue.set(opt[this.bindValue]);
    this.onChange(opt[this.bindValue]);
    this.onTouched();
    this.change.emit(opt[this.bindValue]);
    this.isOpen.set(false);
    this.searchText.set('');
  }
}
