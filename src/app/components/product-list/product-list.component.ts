import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { FavoriteService } from '../../services/favorite.service';
import { AuthService } from '../../services/auth.service';
import { CategoryService, CategoryNode } from '../../services/category.service';
import { decodeJwtPayload } from '../../utils/jwt';

export type ListingMode = 'pro' | 'marketplace';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css']
})
export class ProductListComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('sentinel') sentinelRef!: ElementRef;

  mode: ListingMode = 'pro';
  products: any[] = [];
  loading = true;
  loadingMore = false;
  page = 1;
  pages = 1;
  favoriteIds = new Set<string>();
  isLoggedIn = false;

  // Filters (server-side)
  searchQuery = '';
  selectedCategory = '';
  selectedCondition = '';
  minPrice = '';
  maxPrice = '';
  location = '';
  sort = 'newest';

  categories = ['Electronics', 'Furniture', 'Clothing', 'Sports', 'Music', 'Photography', 'Home & Garden'];
  conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
  // Marketplace-mode category pill row (top-level only from the taxonomy).
  topCategories: CategoryNode[] = [];
  selectedCategoryId: string | null = null;
  // Marketplace pill overflow — first N visible, rest behind "More ▾".
  readonly mpVisibleLimit = 8;
  mpMoreMenuOpen = false;
  sortOptions = [
    { value: 'newest',     label: 'Newest' },
    { value: 'price_asc',  label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
  ];

  private observer!: IntersectionObserver;
  private filterTimer: any;

  constructor(
    private productService: ProductService,
    private favoriteService: FavoriteService,
    private authService: AuthService,
    private categoryService: CategoryService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.route.data.subscribe((data) => {
      const incoming = (data['mode'] as ListingMode) ?? 'pro';
      if (incoming !== this.mode) {
        this.mode = incoming;
        this.resetFiltersForMode();
      }
      this.loadPage(1, true);
    });
    if (this.isLoggedIn) {
      this.favoriteService.getFavoriteIds().subscribe({
        next: (ids) => { this.favoriteIds = new Set(ids); },
        error: () => {}
      });
    }
    // Load the shared category tree so Marketplace can render its pill row.
    this.categoryService.getTree().subscribe({
      next: (tree) => { this.topCategories = tree ?? []; },
      error: () => { this.topCategories = []; },
    });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this.loadingMore && this.page < this.pages) {
        this.loadPage(this.page + 1, false);
      }
    }, { rootMargin: '200px' });
    if (this.sentinelRef) this.observer.observe(this.sentinelRef.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
    clearTimeout(this.filterTimer);
  }

  private resetFiltersForMode(): void {
    // Drop mode-specific filters when switching so stale values don't bleed
    // across (e.g. condition set in Marketplace shouldn't follow to Pro).
    this.selectedCondition = '';
    this.location = '';
    this.selectedCategoryId = null;
  }

  selectMarketplaceCategory(categoryId: string): void {
    this.selectedCategoryId = this.selectedCategoryId === categoryId ? null : categoryId;
    this.loadPage(1, true);
  }

  clearMarketplaceCategory(): void {
    if (this.selectedCategoryId === null) return;
    this.selectedCategoryId = null;
    this.loadPage(1, true);
  }

  get visibleMarketplaceCategories(): CategoryNode[] {
    return this.topCategories.slice(0, this.mpVisibleLimit);
  }

  get overflowMarketplaceCategories(): CategoryNode[] {
    return this.topCategories.slice(this.mpVisibleLimit);
  }

  isOverflowSelected(): boolean {
    if (!this.selectedCategoryId) return false;
    return this.overflowMarketplaceCategories.some((c) => c._id === this.selectedCategoryId);
  }

  toggleMpMoreMenu(event?: Event): void {
    event?.stopPropagation();
    this.mpMoreMenuOpen = !this.mpMoreMenuOpen;
  }

  closeMpMoreMenu(): void { this.mpMoreMenuOpen = false; }

  @HostListener('document:click')
  private onDocumentClickCloseMpMore(): void { this.mpMoreMenuOpen = false; }

  isMarketplace(): boolean { return this.mode === 'marketplace'; }
  isPro(): boolean { return this.mode === 'pro'; }

  private buildParams(page: number): Record<string, string | number> {
    const p: Record<string, string | number> = { page, limit: 20, sort: this.sort };
    if (this.searchQuery)      p['q']         = this.searchQuery;
    if (this.selectedCategory) p['category']  = this.selectedCategory;
    if (this.isMarketplace() && this.selectedCondition) p['condition'] = this.selectedCondition;
    if (this.isMarketplace() && this.selectedCategoryId) {
      p['categoryId'] = this.selectedCategoryId;
      p['includeDescendants'] = 'true';
    }
    if (this.minPrice)         p['minPrice']  = this.minPrice;
    if (this.maxPrice)         p['maxPrice']  = this.maxPrice;
    return p;
  }

  loadPage(page: number, reset: boolean): void {
    if (reset) { this.loading = true; this.products = []; }
    else { this.loadingMore = true; }

    this.productService.getProducts(this.buildParams(page), this.mode).subscribe({
      next: (res) => {
        let items = res.products;
        // Simple client-side `location` match; backend has no radius filter yet.
        if (this.isMarketplace() && this.location.trim()) {
          const needle = this.location.trim().toLowerCase();
          items = items.filter((p: any) => {
            const city = (p.location?.city ?? '').toLowerCase();
            const country = (p.location?.country ?? '').toLowerCase();
            return city.includes(needle) || country.includes(needle);
          });
        }
        this.products = reset ? items : [...this.products, ...items];
        this.page  = res.page;
        this.pages = res.pages;
        this.loading = false;
        this.loadingMore = false;
      },
      error: () => { this.loading = false; this.loadingMore = false; }
    });
  }

  onFilterChange(): void {
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => this.loadPage(1, true), 300);
  }

  selectCategory(cat: string): void {
    this.selectedCategory = this.selectedCategory === cat ? '' : cat;
    this.loadPage(1, true);
  }

  selectCondition(cond: string): void {
    this.selectedCondition = this.selectedCondition === cond ? '' : cond;
    this.loadPage(1, true);
  }

  openProduct(id: string): void { this.router.navigate(['/product', id]); }

  openStorefront(slug: string, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/store', slug]);
  }

  toggleFavorite(productId: string, event: Event): void {
    event.stopPropagation();
    if (!this.isLoggedIn) { this.router.navigate(['/login']); return; }
    this.favoriteService.toggle(productId).subscribe({
      next: (res) => {
        if (res.favorited) this.favoriteIds.add(productId);
        else this.favoriteIds.delete(productId);
        this.favoriteIds = new Set(this.favoriteIds);
      },
      error: () => {}
    });
  }

  isFavorited(productId: string): boolean { return this.favoriteIds.has(productId); }

  deleteProduct(productId: string, event: Event): void {
    event.stopPropagation();
    if (!confirm('Delete this listing?')) return;
    this.productService.deleteProduct(productId).subscribe({
      next: () => { this.products = this.products.filter(p => p._id !== productId); }
    });
  }

  canDeleteProduct(product: any): boolean {
    const payload = decodeJwtPayload<{ id?: string }>(localStorage.getItem('token'));
    return !!payload && product.ownerId === payload.id;
  }

  locationLabel(product: any): string {
    const city = product?.location?.city?.trim();
    const country = product?.location?.country?.trim();
    if (city && country) return `${city}, ${country}`;
    if (country) return country;
    if (city) return city;
    return 'Location not set';
  }

  sellerFirstName(product: any): string {
    const name = product?.ownerId?.name || product?.owner?.name || '';
    return name.split(' ')[0] || 'Seller';
  }

  orgName(product: any): string | null {
    return product?.org?.name || product?.organization?.name || null;
  }

  orgSlug(product: any): string | null {
    return product?.org?.slug || product?.organization?.slug || null;
  }

  pricingMode(product: any): string {
    return product?.pricingMode || product?.pricing_mode || 'fixed';
  }

  displayPrice(product: any): string | null {
    if (this.pricingMode(product) === 'offer') return 'Make offer';
    return null;
  }
}
