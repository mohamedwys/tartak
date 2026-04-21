import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.css'],
})
export class EmptyStateComponent {
  /** Key chooses which zellige-derived SVG illustration to render. */
  @Input() icon: 'catalog' | 'inquiries' | 'favorites' | 'orders' | 'search' | 'storefront' | 'addons' = 'catalog';
  @Input() title = '';
  @Input() body = '';
}
