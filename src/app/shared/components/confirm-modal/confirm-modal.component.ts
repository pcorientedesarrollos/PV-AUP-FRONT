import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirmService.modalState()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in border border-slate-200 dark:border-slate-800">
          
          <div class="p-6">
            <h3 class="text-xl font-bold text-slate-800 dark:text-white mb-2">
              {{ confirmService.modalState()!.config.title }}
            </h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
              {{ confirmService.modalState()!.config.message }}
            </p>
            
            <div class="flex gap-3">
              <button 
                (click)="confirmService.respond(false)"
                class="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {{ confirmService.modalState()!.config.cancelText || 'Cancelar' }}
              </button>
              
              <button 
                (click)="confirmService.respond(true)"
                [ngClass]="confirmService.modalState()!.config.isDanger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[var(--color-primario)] hover:brightness-110 text-[var(--texto-on-primario)]'"
                class="flex-1 px-4 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
              >
                {{ confirmService.modalState()!.config.confirmText || 'Aceptar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmModalComponent {
  confirmService = inject(ConfirmService);
}
