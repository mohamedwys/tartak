import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService, DashboardStats } from '../dashboard.service';
import { decodeJwtPayload } from '../../utils/jwt';

@Component({
  selector: 'app-dashboard-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.css'],
})
export class OverviewComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error = '';
  orgId = '';

  constructor(private dashboard: DashboardService, private router: Router) {}

  ngOnInit(): void {
    const payload = decodeJwtPayload<{ currentOrgId?: string | null }>(localStorage.getItem('token'));
    this.orgId = payload?.currentOrgId ?? '';
    if (!this.orgId) {
      this.error = 'No active organization.';
      this.loading = false;
      return;
    }
    this.dashboard.getStats(this.orgId).subscribe({
      next: (stats) => { this.stats = stats; this.loading = false; },
      error: () => { this.error = 'Failed to load dashboard stats.'; this.loading = false; },
    });
  }

  openListing(): void {
    this.router.navigate(['/dashboard/catalog']);
  }

  openMessage(msg: any): void {
    const me = decodeJwtPayload<{ id?: string }>(localStorage.getItem('token'))?.id;
    const otherId =
      msg?.sender?._id && msg.sender._id !== me ? msg.sender._id
      : msg?.recipient?._id && msg.recipient._id !== me ? msg.recipient._id
      : msg?.senderId && msg.senderId !== me ? msg.senderId
      : msg?.recipientId;
    const productId = msg?.product?._id ?? msg?.productId;
    if (otherId && productId) this.router.navigate(['/conversation', otherId, productId]);
  }

  statusLabel(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
}
