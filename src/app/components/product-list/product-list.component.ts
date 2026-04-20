import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { FavoriteService } from '../../services/favorite.service';
import { AuthService } from '../../services/auth.service';
import { decodeJwtPayload } from '../../utils/jwt';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css']
})
export class ProductListComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('sentinel') sentinelRef!: ElementRef;

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
  sort = 'newest';

  categories = ['Electronics', 'Furniture', 'Clothing', 'Sports', 'Music', 'Photography', 'Home & Garden'];
  conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
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
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.loadPage(1, true);
    if (this.isLoggedIn) {
      this.favoriteService.getFavoriteIds().subscribe({
        next: (ids) => { this.favoriteIds = new Set(ids); },
        error: () => {}
      });
    }
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

  private buildParams(page: number): Record<string, string | number> {
    const p: Record<string, string | number> = { page, limit: 20, sort: this.sort };
    if (this.searchQuery)      p['q']         = this.searchQuery;
    if (this.selectedCategory) p['category']  = this.selectedCategory;
    if (this.selectedCondition) p['condition'] = this.selectedCondition;
    if (this.minPrice)         p['minPrice']  = this.minPrice;
    if (this.maxPrice)         p['maxPrice']  = this.maxPrice;
    return p;
  }

  loadPage(page: number, reset: boolean): void {
    if (reset) { this.loading = true; this.products = []; }
    else { this.loadingMore = true; }

    this.productService.getProducts(this.buildParams(page)).subscribe({
      next: (res) => {
        this.products = reset ? res.products : [...this.products, ...res.products];
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

  openProduct(id: string): void { this.router.navigate(['/product', id]); }

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
}
