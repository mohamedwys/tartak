import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub!: Subscription;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toastService.toasts$.subscribe(toasts => this.toasts = toasts);
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  dismiss(id: number): void { this.toastService.dismiss(id); }

  trackById(_: number, toast: Toast): number { return toast.id; }
}
