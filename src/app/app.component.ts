import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { MessageService } from './services/message.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'E-Commerce Site';
  unreadCount = 0;
  myId = '';
  myInitials = '';

  constructor(
    private authService: AuthService,
    private messageService: MessageService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.refresh();

    // Re-run on every navigation so login/logout switches pick up the new token
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.refresh());
  }

  private refresh(): void {
    if (!this.authService.isLoggedIn()) {
      this.unreadCount = 0;
      this.myId = '';
      this.myInitials = '';
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const newId = payload.id ?? '';
      // Only reload inbox count when the active user changes (e.g. after login)
      if (newId !== this.myId) {
        this.myId = newId;
        const name: string = payload.name ?? payload.email ?? '';
        this.myInitials = name
          .split(' ')
          .map((w: string) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        this.loadUnreadCount();
      }
    } catch {}
  }

  private loadUnreadCount(): void {
    this.messageService.getInbox().subscribe({
      next: (threads: any[]) => {
        this.unreadCount = threads.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0);
      },
      error: () => {}
    });
  }

  logout(): void {
    this.authService.logout();
    window.location.href = '/';
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }
}
