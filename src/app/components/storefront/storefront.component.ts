import { Component, OnDestroy, OnInit } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  OrgService,
  Organization,
  Storefront,
  StorefrontPublicResponse,
} from '../../services/org.service';
import { transformImageUrl } from '../../pipes/image.pipe';

type Tab = 'listings' | 'about';

@Component({
  selector: 'app-storefront',
  templateUrl: './storefront.component.html',
  styleUrls: ['./storefront.component.css'],
})
export class StorefrontComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  error = '';
  slug = '';

  org: Organization | null = null;
  storefront: Storefront | null = null;
  products: any[] = [];
  ratingAverage: number | null = null;
  ratingCount = 0;

  activeTab: Tab = 'listings';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orgService: OrgService,
    private titleService: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      this.slug = p['slug'];
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Reset tags we set so they don't leak to other routes.
    this.titleService.setTitle('Tartak');
    this.meta.removeTag("name='description'");
    this.meta.removeTag("property='og:image'");
    this.meta.removeTag("property='og:title'");
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.orgService.getPublicStorefront(this.slug)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: StorefrontPublicResponse) => {
          this.org = res.org;
          this.storefront = res.storefront;
          this.products = res.products ?? [];
          this.ratingAverage = res.ratings?.average ?? null;
          this.ratingCount = res.ratings?.count ?? 0;
          this.loading = false;
          this.applySeo();
        },
        error: (err) => {
          this.error = err?.status === 404
            ? 'This storefront could not be found.'
            : 'Failed to load storefront.';
          this.loading = false;
        },
      });
  }

  private applySeo(): void {
    const name = this.org?.name ?? 'Tartak';
    const title = this.storefront?.seo?.title || `${name} on Tartak`;
    this.titleService.setTitle(title);

    const description = this.storefront?.seo?.description
      || this.org?.bio
      || `Browse listings from ${name} on Tartak.`;
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });

    const ogImage = this.storefront?.seo?.ogImage || this.org?.coverUrl || this.org?.logoUrl;
    if (ogImage) {
      this.meta.updateTag({ property: 'og:image', content: ogImage });
    } else {
      this.meta.removeTag("property='og:image'");
    }
  }

  get primaryColor(): string { return this.storefront?.theme?.primaryColor || '#1b2332'; }
  get accentColor(): string { return this.storefront?.theme?.accentColor || '#FF6B35'; }
  get bannerStyle(): 'solid' | 'image' {
    const s = this.storefront?.theme?.bannerStyle;
    if (s === 'image' && this.org?.coverUrl) return 'image';
    return 'solid';
  }

  get heroBackground(): string {
    if (this.bannerStyle === 'image' && this.org?.coverUrl) {
      const url = transformImageUrl(this.org.coverUrl, { width: 1600, quality: 80 }) ?? this.org.coverUrl;
      return `url(${url}) center/cover no-repeat`;
    }
    return this.primaryColor;
  }

  get orgInitials(): string {
    if (!this.org?.name) return '?';
    return this.org.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  get isVerified(): boolean {
    return this.org?.kybStatus === 'verified';
  }

  stars(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }

  setTab(tab: Tab): void { this.activeTab = tab; }

  openProduct(id: string): void {
    this.router.navigate(['/product', id]);
  }
}
