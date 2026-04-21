import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-hero',
  templateUrl: './home-hero.component.html',
  styleUrls: ['./home-hero.component.css'],
})
export class HomeHeroComponent implements AfterViewInit {
  @ViewChild('hero', { static: true }) hero!: ElementRef<HTMLElement>;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    // One-shot: drop will-change off each orb after its first animation
    // iteration fires, so the compositor can free the layer. The orbs
    // keep animating normally — will-change is a hint, not a requirement.
    const orbs = this.hero.nativeElement.querySelectorAll<HTMLElement>('.orb');
    orbs.forEach((orb) => {
      const handler = () => {
        orb.style.willChange = 'auto';
        orb.removeEventListener('animationstart', handler);
      };
      orb.addEventListener('animationstart', handler, { once: true });
    });
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
