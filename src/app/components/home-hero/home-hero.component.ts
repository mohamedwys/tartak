import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-hero',
  templateUrl: './home-hero.component.html',
  styleUrls: ['./home-hero.component.css'],
})
export class HomeHeroComponent {
  constructor(private router: Router) {}

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
