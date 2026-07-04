import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="pointer-events-auto flex items-center p-4 w-full max-w-sm text-gray-500 bg-white dark:bg-slate-800 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] dark:text-gray-400 transform transition-all duration-300 animate-slide-in-right border-l-4"
             [ngClass]="{
               'border-emerald-500': toast.type === 'success',
               'border-red-500': toast.type === 'error',
               'border-amber-500': toast.type === 'warning',
               'border-blue-500': toast.type === 'info'
             }">
          
          <div class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-lg"
               [ngClass]="{
                 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300': toast.type === 'success',
                 'text-red-500 bg-red-100 dark:bg-red-900/50 dark:text-red-300': toast.type === 'error',
                 'text-amber-500 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300': toast.type === 'warning',
                 'text-blue-500 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300': toast.type === 'info'
               }">
            @if (toast.type === 'success') {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
            }
            @if (toast.type === 'error') {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            }
            @if (toast.type === 'warning') {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            }
            @if (toast.type === 'info') {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            }
          </div>
          
          <div class="ml-3 text-sm font-medium text-slate-800 dark:text-slate-100 mr-8">{{ toast.message }}</div>
          
          <button type="button" (click)="toastService.remove(toast.id)" class="ml-auto -mx-1.5 -my-1.5 bg-white dark:bg-slate-800 text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 inline-flex items-center justify-center h-8 w-8 transition-colors">
            <span class="sr-only">Close</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in-right {
      animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
}
