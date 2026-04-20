import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { DashboardService, ProductStatus } from '../dashboard.service';
import { ProductService } from '../../services/product.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ToastService } from '../../services/toast.service';
import { decodeJwtPayload } from '../../utils/jwt';

type SortOption = 'newest' | 'price_asc' | 'price_desc';

@Component({
  selector: 'app-dashboard-catalog',
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.css'],
})
export class CatalogComponent implements OnInit, OnDestroy {
  products: any[] = [];
  total = 0;
  page = 1;
  pages = 1;
  limit = 20;

  q = '';
  status: ProductStatus | '' = '';
  sort: SortOption = 'newest';

  loading = true;
  error = '';
  orgId = '';

  openMenuId: string | null = null;
  statusOptions: ProductStatus[] = ['draft', 'active', 'paused', 'sold', 'removed'];

  // Surfaced next to the "Create listing" button so sellers always see
  // how much headroom they have against their plan. null = unlimited.
  listingLimit: number | null = null;
  activeListingCount = 0;

  private search$ = new Subject<string>();
  private sub?: Subscription;

  constructor(
    private dashboard: DashboardService,
    private products$: ProductService,
    private subs: SubscriptionService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const payload = decodeJwtPayload<{ currentOrgId?: string | null }>(localStorage.getItem('token'));
    this.orgId = payload?.currentOrgId ?? '';
    this.sub = this.search$.pipe(debounceTime(300)).subscribe((q) => {
      this.q = q;
      this.page = 1;
      this.load();
    });
    this.load();
    this.loadUsage();
  }

  private loadUsage(): void {
    if (!this.orgId) return;
    this.subs.getOrgSubscription(this.orgId).subscribe({
      next: (res) => {
        this.listingLimit = res.usage.listingLimit;
        this.activeListingCount = res.usage.activeListings;
      },
      error: () => { /* non-critical — hide the badge silently */ },
    });
  }

  openPlan(): void {
    this.router.navigate(['/dashboard/plan']);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSearchChange(value: string): void {
    this.search$.next(value);
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  load(): void {
    if (!this.orgId) {
      this.error = 'No active organization.';
      this.loading = false;
      return;
    }
    this.loading = true;
    this.error = '';
    this.dashboard.getProducts(this.orgId, {
      page: this.page,
      limit: this.limit,
      q: this.q || undefined,
      status: this.status || undefined,
      sort: this.sort,
    }).subscribe({
      next: (res) => {
        this.products = res.products;
        this.total = res.total;
        this.page = res.page;
        this.pages = res.pages;
        this.loading = false;
      },
      error: () => { this.error = 'Failed to load listings.'; this.loading = false; },
    });
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  closeMenus(): void {
    this.openMenuId = null;
  }

  changeStatus(product: any, status: ProductStatus): void {
    this.openMenuId = null;
    if (product.status === status) return;
    this.dashboard.updateStatus(product._id, status).subscribe({
      next: (updated) => {
        const idx = this.products.findIndex((p) => p._id === product._id);
        if (idx >= 0) this.products[idx] = { ...this.products[idx], ...updated };
        this.toast.success(`Marked as ${status}.`);
      },
      error: () => this.toast.error('Failed to update status.'),
    });
  }

  edit(product: any): void {
    this.router.navigate(['/edit-product', product._id]);
  }

  remove(product: any): void {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    this.products$.deleteProduct(product._id).subscribe({
      next: () => {
        this.products = this.products.filter((p) => p._id !== product._id);
        this.total = Math.max(0, this.total - 1);
        this.toast.success('Listing deleted.');
      },
      error: () => this.toast.error('Failed to delete listing.'),
    });
  }

  createListing(): void {
    this.router.navigate(['/add-product']);
  }

  statusLabel(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  trackById(_: number, p: any): string { return p._id; }
}
