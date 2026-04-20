import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  AddonService,
  formatPrice,
  OrgAddon,
  OrgSubscriptionResponse,
  SubscriptionPlan,
  SubscriptionService,
} from '../../services/subscription.service';
import { decodeJwtPayload } from '../../utils/jwt';

type FeatureKey = 'listing_limit' | 'verified_badge' | 'advanced_analytics' | 'priority_support';

interface ComparisonRow {
  key: FeatureKey;
  label: string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { key: 'listing_limit',      label: 'Listing limit' },
  { key: 'verified_badge',     label: 'Verified badge' },
  { key: 'advanced_analytics', label: 'Advanced analytics' },
  { key: 'priority_support',   label: 'Priority support' },
];

// Copy is shared across the two disabled CTAs so the message stays in one
// place if marketing wants to swap "support@tartak.app" later.
const COMING_SOON_COPY = 'Online payment coming soon. Email support@tartak.app to upgrade manually.';

@Component({
  selector: 'app-dashboard-plan',
  templateUrl: './plan.component.html',
  styleUrls: ['./plan.component.css'],
})
export class PlanComponent implements OnInit {
  loading = true;
  error = '';
  orgId = '';

  current: OrgSubscriptionResponse | null = null;
  plans: SubscriptionPlan[] = [];
  addons: AddonService[] = [];
  orgAddons: OrgAddon[] = [];

  comparisonRows = COMPARISON_ROWS;
  comingSoon = COMING_SOON_COPY;

  constructor(private subs: SubscriptionService) {}

  ngOnInit(): void {
    const payload = decodeJwtPayload<{ currentOrgId?: string | null }>(localStorage.getItem('token'));
    this.orgId = payload?.currentOrgId ?? '';
    if (!this.orgId) {
      this.error = 'No active organization.';
      this.loading = false;
      return;
    }

    forkJoin({
      current: this.subs.getOrgSubscription(this.orgId),
      plans:   this.subs.getPlans(),
      addons:  this.subs.getAddons(),
      mine:    this.subs.getOrgAddons(this.orgId),
    }).subscribe({
      next: ({ current, plans, addons, mine }) => {
        this.current = current;
        this.plans = plans;
        this.addons = addons;
        this.orgAddons = mine;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load plan information.';
        this.loading = false;
      },
    });
  }

  get freePlan(): SubscriptionPlan | null {
    return this.plans.find((p) => p.slug === 'free') ?? null;
  }

  get proPlan(): SubscriptionPlan | null {
    return this.plans.find((p) => p.slug === 'pro') ?? null;
  }

  get currentPlanSlug(): string | null {
    return this.current?.plan.slug ?? null;
  }

  planPrice(plan: SubscriptionPlan | null): string {
    if (!plan) return '';
    if (plan.priceMinor === 0) return `0 ${plan.currency}`;
    return formatPrice(plan.priceMinor, plan.currency);
  }

  planBlurb(plan: SubscriptionPlan | null): string {
    if (!plan) return '';
    return plan.billingInterval === 'month' ? `${this.planPrice(plan)}/month` : this.planPrice(plan);
  }

  addonBlurb(addon: AddonService): string {
    const price = formatPrice(addon.priceMinor, addon.currency);
    if (addon.type === 'one_time' && addon.durationDays) {
      return `${price} / ${addon.durationDays} days`;
    }
    if (addon.type === 'recurring') return `${price} / month`;
    return price;
  }

  featureValue(plan: SubscriptionPlan | null, key: FeatureKey): string {
    if (!plan) return '—';
    const raw = plan.features?.[key];
    if (key === 'listing_limit') {
      if (typeof raw === 'number') return `${raw} listings`;
      return 'Unlimited';
    }
    return raw ? 'Included' : 'Not included';
  }

  addonNameForSlug(slug: string): string {
    return this.addons.find((a) => a.slug === slug)?.name ?? slug;
  }

  /** Percentage of listing quota consumed (0–100+). Pro → unlimited → 0. */
  get usagePercent(): number {
    const usage = this.current?.usage;
    if (!usage || usage.listingLimit == null) return 0;
    if (usage.listingLimit === 0) return 100;
    return Math.min(100, Math.round((usage.activeListings / usage.listingLimit) * 100));
  }

  get usageTier(): 'ok' | 'warn' | 'danger' {
    const p = this.usagePercent;
    if (p >= 90) return 'danger';
    if (p >= 70) return 'warn';
    return 'ok';
  }
}
