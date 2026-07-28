import os

with open('src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove buttons from top bar
buttons_top = """    <div class="flex gap-2">
      <button (click)="cancelar()" class="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 font-medium transition-colors border border-slate-200 dark:border-slate-700">
        Cancelar
      </button>
      <button (click)="guardarCotizacion()" [disabled]="guardando()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50">
        @if (guardando()) {
          <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Creando...
        } @else {
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Crear cotización
        }
      </button>
    </div>"""

content = content.replace(buttons_top, "")

# 2. Add buttons to the bottom of the page
buttons_bottom = """
  <!-- BOTONES INFERIORES -->
  <div class="flex justify-end gap-4 mt-2">
    <button (click)="cancelar()" class="px-6 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 font-medium transition-colors border border-slate-200 dark:border-slate-700">
      Cancelar
    </button>
    <button (click)="guardarCotizacion()" [disabled]="guardando()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50">
      @if (guardando()) {
        <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Creando...
      } @else {
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        Crear cotización
      }
    </button>
  </div>
</div>"""

if "<!-- BOTONES INFERIORES -->" not in content:
    content = content.replace("</div>\n</div>", "</div>\n" + buttons_bottom)

# 3. Add refresh button next to "Tipo de Cambio"
old_tc = """<input type="number" [(ngModel)]="tipoCambio" (ngModelChange)="actualizarFila()" step="0.1" class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">"""

new_tc = """<div class="flex gap-2">
            <input type="number" [(ngModel)]="tipoCambio" (ngModelChange)="actualizarFila()" step="0.1" class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <button (click)="cargarTipoCambio()" title="Actualizar al día" class="bg-indigo-100 text-indigo-700 px-3 rounded-lg text-sm font-semibold hover:bg-indigo-200">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
          </div>"""

content = content.replace(old_tc, new_tc)

with open('src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("HTML Updated")
