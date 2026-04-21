import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';

interface FloatingCardVM {
  imageUrl: string | null;
  name: string;
  priceLabel: string;
}

@Component({
  selector: 'app-home-hero',
  templateUrl: './home-hero.component.html',
  styleUrls: ['./home-hero.component.css'],
})
export class HomeHeroComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('hero', { static: true }) hero!: ElementRef<HTMLElement>;

  /** Real Pro listings shown as decorative floating cards (desktop >1100px only). */
  floatingCards: FloatingCardVM[] = [];
  floatingLoading = true;

  private parallaxFrame = 0;
  private mousemoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseleaveHandler: (() => void) | null = null;
  private scrollObserver?: IntersectionObserver;
  private reducedMotion = false;

  constructor(
    private router: Router,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    this.productService
      .getProducts({ page: 1, limit: 2, sort: 'newest' }, 'pro')
      .subscribe({
        next: (res) => {
          this.floatingCards = (res.products ?? []).slice(0, 2).map((p: any) => ({
            imageUrl: p.imageUrl ?? null,
            name: p.name ?? '',
            priceLabel: this.formatPrice(p.price),
          }));
          this.floatingLoading = false;
        },
        error: () => {
          this.floatingCards = [];
          this.floatingLoading = false;
        },
      });
  }

  private formatPrice(n: unknown): string {
    const num = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(num)) return '';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'MAD',
        maximumFractionDigits: 0,
      }).format(num);
    } catch {
      return `MAD ${Math.round(num)}`;
    }
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    this.reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // One-shot: drop will-change off each orb after first iteration
    // so the compositor can free the layer.
    const orbs = this.hero.nativeElement.querySelectorAll<HTMLElement>('.orb');
    orbs.forEach((orb) => {
      const handler = () => {
        orb.style.willChange = 'auto';
        orb.removeEventListener('animationstart', handler);
      };
      orb.addEventListener('animationstart', handler, { once: true });
    });

    if (!this.reducedMotion) {
      this.setupMouseParallax();
    }

    this.setupScrollOutObserver();
  }

  ngOnDestroy(): void {
    if (this.parallaxFrame) {
      cancelAnimationFrame(this.parallaxFrame);
      this.parallaxFrame = 0;
    }
    if (this.mousemoveHandler) {
      this.hero.nativeElement.removeEventListener('mousemove', this.mousemoveHandler);
      this.mousemoveHandler = null;
    }
    if (this.mouseleaveHandler) {
      this.hero.nativeElement.removeEventListener('mouseleave', this.mouseleaveHandler);
      this.mouseleaveHandler = null;
    }
    this.scrollObserver?.disconnect();
    this.scrollObserver = undefined;
  }

  /**
   * Mouse parallax: map cursor position to normalized --mx/--my CSS
   * custom properties on the hero root (range -1..1). CSS consumes
   * them via calc(var(--mx) * N). rAF debounces so we never run
   * more than once per frame.
   */
  private setupMouseParallax(): void {
    const el = this.hero.nativeElement;

    this.mousemoveHandler = (e: MouseEvent) => {
      if (this.parallaxFrame) return;
      this.parallaxFrame = requestAnimationFrame(() => {
        this.parallaxFrame = 0;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const mx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
        const my = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));
        el.style.setProperty('--mx', mx.toFixed(3));
        el.style.setProperty('--my', my.toFixed(3));
      });
    };

    this.mouseleaveHandler = () => {
      el.style.setProperty('--mx', '0');
      el.style.setProperty('--my', '0');
    };

    el.addEventListener('mousemove', this.mousemoveHandler, { passive: true });
    el.addEventListener('mouseleave', this.mouseleaveHandler, { passive: true });
  }

  /**
   * Scroll-out fade: IntersectionObserver on the hero root. When
   * less than 60% is visible the content fades + scales. No scroll
   * event listener.
   */
  private setupScrollOutObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const el = this.hero.nativeElement;
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.6) {
            el.classList.add('scrolled-out');
          } else {
            el.classList.remove('scrolled-out');
          }
        }
      },
      { threshold: [0, 0.3, 0.6, 1] },
    );
    this.scrollObserver.observe(el);
  }

  onStartSelling(): void {
    this.router.navigateByUrl('/onboarding/business');
  }

  onBrowseCatalog(event: Event): void {
    const target = document.getElementById('home-tiles');
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
