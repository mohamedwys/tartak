import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  Renderer2,
} from '@angular/core';

/**
 * [appReveal] — adds the `.revealed` class the first time the element scrolls
 * into the viewport, driving the fade-up reveal defined in styles.css.
 * A no-op when IntersectionObserver is unavailable (SSR / old browsers).
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  @Input('appReveal') threshold = 0.12;
  @Input() revealOnce = true;

  private observer: IntersectionObserver | null = null;

  constructor(private el: ElementRef<HTMLElement>, private r2: Renderer2) {}

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    this.r2.setAttribute(node, 'data-reveal', '');

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      this.r2.addClass(node, 'revealed');
      return;
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.r2.addClass(node, 'revealed');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            this.r2.addClass(e.target, 'revealed');
            if (this.revealOnce) this.observer?.unobserve(e.target);
          } else if (!this.revealOnce) {
            this.r2.removeClass(e.target, 'revealed');
          }
        }
      },
      { threshold: this.threshold, rootMargin: '0px 0px -48px 0px' },
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
