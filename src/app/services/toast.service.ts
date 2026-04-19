import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  toasts$ = new Subject<Toast[]>();
  private toasts: Toast[] = [];

  show(message: string, type: Toast['type'] = 'info'): void {
    const id = ++this.counter;
    this.toasts = [...this.toasts, { id, message, type }];
    this.toasts$.next(this.toasts);
    setTimeout(() => this.dismiss(id), 3000);
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string):   void { this.show(message, 'error'); }
  info(message: string):    void { this.show(message, 'info'); }

  dismiss(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.toasts$.next(this.toasts);
  }
}
