import { Injectable, signal } from '@angular/core';

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  public modalState = signal<{ config: ConfirmConfig, resolve: (value: boolean) => void } | null>(null);

  confirm(config: ConfirmConfig): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.modalState.set({ config, resolve });
    });
  }

  respond(result: boolean) {
    const current = this.modalState();
    if (current) {
      current.resolve(result);
      this.modalState.set(null);
    }
  }
}
