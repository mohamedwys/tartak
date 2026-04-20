import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

interface StubInfo {
  title: string;
  description: string;
  bullets: string[];
  externalLink?: { label: string; route: string };
}

const STUBS: Record<string, StubInfo> = {
  messages: {
    title: 'Messages',
    description: 'A unified, agent-assignable inbox for every conversation across your organization.',
    bullets: ['Thread assignment to teammates', 'Canned replies', 'Read receipts across the team'],
    externalLink: { label: 'Open the consumer inbox for now →', route: '/inbox' },
  },
  offers: {
    title: 'Offers',
    description: 'Review, counter, and accept buyer offers at scale.',
    bullets: ['Bulk accept/decline', 'Counter-offer templates', 'Offer performance metrics'],
  },
  customers: {
    title: 'Customers',
    description: 'A CRM-style directory of buyers you have talked to or transacted with.',
    bullets: ['Contact notes and tags', 'Repeat buyer insights', 'Segment exports'],
  },
  promotions: {
    title: 'Promotions',
    description: 'Schedule discounts, highlight listings, and run campaigns.',
    bullets: ['Discount codes', 'Featured placements', 'Campaign scheduling'],
  },
  storefront: {
    title: 'Storefront',
    description: 'Your public, branded storefront page — bio, cover image, featured products.',
    bullets: ['Custom URL', 'Cover + logo editor', 'Highlight collections'],
  },
  team: {
    title: 'Team',
    description: 'Invite teammates and manage their roles and permissions.',
    bullets: ['Owner / Admin / Manager / Agent roles', 'Pending invites', 'Audit log'],
  },
  settings: {
    title: 'Settings',
    description: 'Organization profile, billing, notifications, and integrations.',
    bullets: ['Business profile (KYB)', 'Notification preferences', 'Webhooks & API keys'],
  },
};

const DEFAULT_STUB: StubInfo = {
  title: 'Coming soon',
  description: 'This section of the pro dashboard is under construction.',
  bullets: [],
};

@Component({
  selector: 'app-dashboard-coming-soon',
  templateUrl: './coming-soon.component.html',
  styleUrls: ['./coming-soon.component.css'],
})
export class ComingSoonComponent implements OnInit, OnDestroy {
  info: StubInfo = DEFAULT_STUB;
  private sub?: Subscription;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.sub = this.route.data.subscribe((data) => {
      const key = data['stub'] as string | undefined;
      this.info = (key && STUBS[key]) || DEFAULT_STUB;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
