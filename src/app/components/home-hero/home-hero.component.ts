import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { HomeService, Banner } from '../../services/home.service';

@Component({
  selector: 'app-home-hero',
  templateUrl: './home-hero.component.html',
  styleUrls: ['./home-hero.component.css'],
})
export class HomeHeroComponent implements OnInit, OnDestroy {
  banners: Banner[] = [];
  index = 0;
  loading = true;

  private rotateTimer: any;
  private readonly rotateEveryMs = 5000;
  private reducedMotion = false;

  constructor(
    private home: HomeService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.reducedMotion = typeof window !== 'undefined'
      && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.home.getHome().subscribe({
      next: (res) => {
        this.banners = res.banners ?? [];
        this.loading = false;
        this.startAutoRotate();
        this.cdr.markForCheck();
      },
      error: () => {
        this.banners = [];
        this.loading = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoRotate();
  }

  private startAutoRotate(): void {
    this.stopAutoRotate();
    if (this.reducedMotion || this.banners.length <= 1) return;
    this.rotateTimer = setInterval(() => {
      this.index = (this.index + 1) % this.banners.length;
      this.cdr.markForCheck();
    }, this.rotateEveryMs);
  }

  private stopAutoRotate(): void {
    if (this.rotateTimer) {
      clearInterval(this.rotateTimer);
      this.rotateTimer = null;
    }
  }

  prev(): void {
    if (this.banners.length === 0) return;
    this.index = (this.index - 1 + this.banners.length) % this.banners.length;
    this.startAutoRotate();
  }

  next(): void {
    if (this.banners.length === 0) return;
    this.index = (this.index + 1) % this.banners.length;
    this.startAutoRotate();
  }

  goTo(i: number): void {
    if (i < 0 || i >= this.banners.length) return;
    this.index = i;
    this.startAutoRotate();
  }

  onCtaClick(banner: Banner): void {
    if (!banner?.ctaUrl) return;
    if (/^https?:\/\//i.test(banner.ctaUrl)) {
      window.location.href = banner.ctaUrl;
    } else {
      this.router.navigateByUrl(banner.ctaUrl);
    }
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft')  { this.prev(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { this.next(); e.preventDefault(); }
  }

  bgStyle(banner: Banner): Record<string, string> {
    if (banner.imageUrl) {
      return {
        'background-image':
          `linear-gradient(180deg, rgba(26,26,26,0.1) 0%, rgba(26,26,26,0.5) 100%), url("${banner.imageUrl}")`,
        'background-size': 'cover',
        'background-position': 'center',
      };
    }
    return { 'background-color': banner.bgColor ?? 'var(--brand-900)' };
  }

  trackById(_: number, b: Banner): string { return b._id; }
}
