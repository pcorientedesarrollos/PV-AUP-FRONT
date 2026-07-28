import os
with open('src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Global Tipo de Cambio to add 'Aplicar a todos' button
old_global_tc = '''<div class="flex gap-2">
            <input type="number" [(ngModel)]="tipoCambio" (ngModelChange)="actualizarFila()" step="0.1" class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <button (click)="cargarTipoCambio()" title="Actualizar al día" class="bg-indigo-100 text-indigo-700 px-3 rounded-lg text-sm font-semibold hover:bg-indigo-200">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
          </div>'''

new_global_tc = '''<div class="flex gap-2">
            <input type="number" [(ngModel)]="tipoCambio" (ngModelChange)="actualizarFila()" step="0.1" class="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <button (click)="cargarTipoCambio()" title="Actualizar al día" class="bg-indigo-100 text-indigo-700 px-3 rounded-lg text-sm font-semibold hover:bg-indigo-200">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
            <button (click)="aplicarTipoCambioGlobal()" class="bg-indigo-100 text-indigo-700 px-3 rounded-lg text-sm font-semibold hover:bg-indigo-200">Aplicar a todos</button>
          </div>'''
content = content.replace(old_global_tc, new_global_tc)

# 2. Add Table Header
old_th = '''<th class="py-3 px-2 text-center">Moneda</th>
              <th class="py-3 px-2 text-center w-24">Utilidad %</th>'''
new_th = '''<th class="py-3 px-2 text-center">Moneda</th>
              <th class="py-3 px-2 text-center w-20">T.C.</th>
              <th class="py-3 px-2 text-center w-24">Utilidad %</th>'''
content = content.replace(old_th, new_th)

# 3. Add Table Row
old_td = '''<option value="USD">USD</option>
                  </select>
                </td>
                <td class="py-3 px-2 text-center">
                  <input type="number" [(ngModel)]="item.utilidadPorcentaje"'''
new_td = '''<option value="USD">USD</option>
                  </select>
                </td>
                <td class="py-3 px-2 text-center">
                  <input type="number" [(ngModel)]="item.tipoCambio" (ngModelChange)="actualizarFila()" [disabled]="item.moneda !== 'USD'" [class.opacity-50]="item.moneda !== 'USD'" class="w-16 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded p-1.5 text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" min="1" step="0.1">
                </td>
                <td class="py-3 px-2 text-center">
                  <input type="number" [(ngModel)]="item.utilidadPorcentaje"'''
content = content.replace(old_td, new_td)

with open('src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('HTML UPDATED')
