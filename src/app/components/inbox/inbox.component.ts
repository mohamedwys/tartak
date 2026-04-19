import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from '../../services/message.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-inbox',
  templateUrl: './inbox.component.html',
  styleUrls: ['./inbox.component.css']
})
export class InboxComponent implements OnInit {
  threads: any[] = [];
  loading = true;
  error = '';
  currentUserId = '';

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) { this.router.navigate(['/login']); return; }
    this.currentUserId = this.getMyId();
    this.messageService.getInbox().subscribe({
      next: (threads) => { this.threads = threads; this.loading = false; },
      error: () => { this.error = 'Failed to load messages.'; this.loading = false; }
    });
  }

  private getMyId(): string {
    const token = localStorage.getItem('token');
    if (!token) return '';
    try { return JSON.parse(atob(token.split('.')[1])).id; } catch { return ''; }
  }

  openConversation(thread: any): void {
    const otherId = thread.otherUser._id;
    const productId = thread.product._id;
    this.router.navigate(['/conversation', otherId, productId]);
  }

  initials(name: string): string {
    return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  }
}
