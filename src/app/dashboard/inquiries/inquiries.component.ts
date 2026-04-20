import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService, InquiryThread } from '../dashboard.service';
import { decodeJwtPayload } from '../../utils/jwt';

type Filter = 'all' | 'unread' | 'offers';

@Component({
  selector: 'app-dashboard-inquiries',
  templateUrl: './inquiries.component.html',
  styleUrls: ['./inquiries.component.css'],
})
export class InquiriesComponent implements OnInit {
  threads: InquiryThread[] = [];
  loading = true;
  error = '';
  orgId = '';
  filter: Filter = 'all';

  constructor(private dashboard: DashboardService, private router: Router) {}

  ngOnInit(): void {
    const payload = decodeJwtPayload<{ currentOrgId?: string | null }>(localStorage.getItem('token'));
    this.orgId = payload?.currentOrgId ?? '';
    if (!this.orgId) {
      this.error = 'No active organization.';
      this.loading = false;
      return;
    }
    this.dashboard.getInquiries(this.orgId).subscribe({
      next: (threads) => { this.threads = threads; this.loading = false; },
      error: () => { this.error = 'Failed to load inquiries.'; this.loading = false; },
    });
  }

  get visibleThreads(): InquiryThread[] {
    if (this.filter === 'unread') return this.threads.filter((t) => t.unreadCount > 0);
    if (this.filter === 'offers') return this.threads.filter((t) => !!t.pendingOffer);
    return this.threads;
  }

  setFilter(f: Filter): void { this.filter = f; }

  open(thread: InquiryThread): void {
    this.router.navigate(['/conversation', thread.otherUser._id, thread.product._id]);
  }

  initials(name: string): string {
    return name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  }

  trackByThread(_: number, t: InquiryThread): string {
    return `${t.otherUser._id}:${t.product._id}`;
  }
}
