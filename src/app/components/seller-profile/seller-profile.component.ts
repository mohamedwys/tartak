import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { ProductService } from '../../services/product.service';
import { RatingService } from '../../services/rating.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-seller-profile',
  templateUrl: './seller-profile.component.html',
  styleUrls: ['./seller-profile.component.css']
})
export class SellerProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  seller: any = null;
  listings: any[] = [];
  loading = true;
  error = '';
  sellerId = '';

  ratings: any[] = [];
  ratingLoading = false;
  showRatingForm = false;
  ratingStars = 5;
  ratingComment = '';
  submittingRating = false;
  ratingError = '';
  ratingSuccess = '';
  loggedInUserId = '';

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private productService: ProductService,
    private ratingService: RatingService,
    private authService: AuthService,
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (token) {
      try { this.loggedInUserId = JSON.parse(atob(token.split('.')[1])).id; } catch {}
    }
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.sellerId = params['id'];
      this.loadProfile();
    });
  }

  private loadProfile(): void {
    this.loading = true;
    // Get profile from user endpoint
    this.productService.getProductsByOwner(this.sellerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.listings = res.products;
        // seller info comes from first listing's ownerId (populated)
        if (res.products.length > 0 && res.products[0].ownerId) {
          this.seller = res.products[0].ownerId;
        }
        this.loading = false;
      },
      error: () => { this.error = 'Could not load profile.'; this.loading = false; }
    });
    // Also fetch from public profile endpoint
    this.productService.getSellerProfile(this.sellerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (profile) => { this.seller = profile; },
      error: () => {}
    });
    // Fetch ratings
    this.ratingService.getSellerRatings(this.sellerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r) => { this.ratings = r; },
      error: () => {}
    });
  }

  get isOwnProfile(): boolean { return this.loggedInUserId === this.sellerId; }
  get avgRating(): number | null { return this.seller?.avgRating ?? null; }
  get ratingCount(): number { return this.seller?.ratingCount ?? 0; }

  stars(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }

  get sellerInitials(): string {
    if (!this.seller?.name) return '?';
    return this.seller.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  openProduct(id: string): void {
    this.router.navigate(['/product', id]);
  }

  memberSince(): string {
    if (!this.seller?.createdAt) return '';
    return new Date(this.seller.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  submitRating(): void {
    this.submittingRating = true;
    this.ratingError = '';
    this.ratingService.submitRating({ sellerId: this.sellerId, stars: this.ratingStars, comment: this.ratingComment || undefined })
      .pipe(
        switchMap(() => this.ratingService.getSellerRatings(this.sellerId)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (refreshedRatings) => {
          this.ratings = refreshedRatings;
          this.ratingSuccess = 'Rating submitted!';
          this.showRatingForm = false;
          this.submittingRating = false;
        },
        error: (err: any) => {
          this.ratingError = err.error?.message ?? 'Failed to submit rating.';
          this.submittingRating = false;
        }
      });
  }
}
