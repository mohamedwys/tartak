import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { HomeService, FeaturedStorefront } from '../../services/home.service';
import { FavoriteService } from '../../services/favorite.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home-featured',
  templateUrl: './home-featured.component.html',
  styleUrls: ['./home-featured.component.css'],
})
export class HomeFeaturedComponent implements OnInit {
  trending: any[] = [];
  storefronts: FeaturedStorefront[] = [];
  loading = true;
  favoriteIds = new Set<string>();
  isLoggedIn = false;

  constructor(
    private home: HomeService,
    private router: Router,
    private favoriteService: FavoriteService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.home.getHome().subscribe({
      next: (res) => {
        this.trending = res.featured?.trending ?? [];
        this.storefronts = res.featured?.featuredStorefronts ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.trending = [];
        this.storefronts = [];
        this.loading = false;
      },
    });

    if (this.isLoggedIn) {
      this.favoriteService.getFavoriteIds().subscribe({
        next: (ids) => { this.favoriteIds = new Set(ids); this.cdr.markForCheck(); },
        error: () => {},
      });
    }
  }

  openProduct(id: string): void { this.router.navigate(['/product', id]); }

  openStorefront(slug: string): void {
    if (!slug) return;
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
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  isFavorited(id: string): boolean { return this.favoriteIds.has(id); }

  orgName(product: any): string | null {
    return product?.org?.name || product?.organization?.name || null;
  }

  orgSlug(product: any): string | null {
    return product?.org?.slug || product?.organization?.slug || null;
  }

  initial(name: string | null | undefined): string {
    return (name ?? '?').trim().charAt(0).toUpperCase();
  }

  trackProduct(_: number, p: any): string { return p._id; }
  trackStore(_: number, s: FeaturedStorefront): string { return s._id; }
}
