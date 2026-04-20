import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AddonService,
  formatPrice,
  OrgAddon,
  OrgSubscriptionResponse,
  SubscriptionPlan,
  SubscriptionService,
} from '../../services/subscription.service';
import { BillingService } from '../../services/billing.service';
import { DashboardService } from '../dashboard.service';
import { ToastService } from '../../services/toast.service';
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

const HOMEPAGE_FEATURE_SLUG = 'homepage-feature';

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

  // Cached to gate the homepage-feature Add button (can't feature a
  // listing that doesn't exist yet). Lazy-loaded on first render.
  myProducts: { id: string; name: string }[] | null = null;

  // Single in-flight action at a time to avoid double-clicks sending two
  // Checkout Sessions. The string identifies which button is spinning.
  busy: 'upgrade' | 'portal' | `addon:${string}` | null = null;

  comparisonRows = COMPARISON_ROWS;

  constructor(
    private subs: SubscriptionService,
    private billing: BillingService,
    private dashboard: DashboardService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const payload = decodeJwtPayload<{ currentOrgId?: string | null }>(localStorage.getItem('token'));
    this.orgId = payload?.currentOrgId ?? '';
    if (!this.orgId) {
      this.error = 'No active organization.';
      this.loading = false;
      return;
    }

    this.consumeBillingQueryParam();

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

    // Preload the org's listings in the background so the homepage-feature
    // selection dialog can render instantly when the button is clicked.
    this.dashboard.getProducts(this.orgId, { limit: 100 }).subscribe({
      next: (res) => {
        this.myProducts = (res.products ?? []).map((p) => ({ id: p._id, name: p.name }));
      },
      error: () => {
        // Non-fatal — clicking Add on homepage-feature will simply fall
        // back to asking Stripe to run without a productId (which the
        // backend allows — the operator can resolve manually).
        this.myProducts = [];
      },
    });
  }

  private consumeBillingQueryParam(): void {
    const status = this.route.snapshot.queryParamMap.get('billing');
    if (!status) return;

    if (status === 'success') {
      this.toast.success('Subscription activated');
    } else if (status === 'cancel') {
      this.toast.info('Checkout cancelled. No charge was made.');
    }

    // Strip so refreshing doesn't re-toast.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { billing: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private handleBillingError(err: any): void {
    const status = err?.status ?? 0;
    const message = err?.error?.message ?? '';

    if (status === 503) {
      this.toast.error('Billing is temporarily unavailable. Please try again later or contact support.');
    } else if (status === 403) {
      this.toast.error('Only org admins and owners can manage billing.');
    } else if (status === 400 && message) {
      this.toast.error(message);
    } else if (status === 409 && message) {
      this.toast.info(message);
    } else {
      this.toast.error('Something went wrong. Please try again.');
    }
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

  get canManageBilling(): boolean {
    return !!this.current?.subscription.hasBillingProfile;
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

  onUpgradeToPro(): void {
    if (this.busy) return;
    this.busy = 'upgrade';
    this.billing.startSubscriptionCheckout(this.orgId).subscribe({
      next: ({ url }) => {
        if (url) window.location.href = url;
        else { this.busy = null; this.toast.error('Checkout is temporarily unavailable.'); }
      },
      error: (err) => { this.busy = null; this.handleBillingError(err); },
    });
  }

  onManageBilling(): void {
    if (this.busy) return;
    this.busy = 'portal';
    this.billing.openBillingPortal(this.orgId).subscribe({
      next: ({ url }) => {
        if (url) window.location.href = url;
        else { this.busy = null; this.toast.error('Billing portal is temporarily unavailable.'); }
      },
      error: (err) => { this.busy = null; this.handleBillingError(err); },
    });
  }

  onAddAddon(addon: AddonService): void {
    if (this.busy) return;

    let productId: string | undefined;
    if (addon.slug === HOMEPAGE_FEATURE_SLUG) {
      const products = this.myProducts ?? [];
      if (products.length === 0) {
        this.toast.info('Create a listing first to feature it.');
        return;
      }
      // Native prompt-style picker — matches the scope ("simple native
      // <select>") without bringing in a new modal component.
      const picked = this.promptForListing(products);
      if (!picked) return;
      productId = picked;
    }

    this.busy = `addon:${addon.slug}`;
    this.billing.startAddonCheckout(this.orgId, addon.slug, productId).subscribe({
      next: ({ url }) => {
        if (url) window.location.href = url;
        else { this.busy = null; this.toast.error('Checkout is temporarily unavailable.'); }
      },
      error: (err) => { this.busy = null; this.handleBillingError(err); },
    });
  }

  isAddonDisabled(addon: AddonService): boolean {
    if (addon.slug === HOMEPAGE_FEATURE_SLUG) {
      // Still loading? Let them click — we'll revalidate before posting.
      if (this.myProducts === null) return false;
      if (this.myProducts.length === 0) return true;
    }
    return !!this.busy;
  }

  addonDisabledHint(addon: AddonService): string {
    if (addon.slug === HOMEPAGE_FEATURE_SLUG &&
        this.myProducts !== null && this.myProducts.length === 0) {
      return 'Create a listing first to feature it.';
    }
    return '';
  }

  /**
   * Blocking prompt that asks the owner to pick a listing by index. It's
   * deliberately primitive — the spec calls for a "simple native select"
   * and native <select> modals aren't a thing on the web, so a numbered
   * window.prompt is the smallest thing that fits.
   */
  private promptForListing(products: { id: string; name: string }[]): string | null {
    const lines = products.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const raw = window.prompt(`Pick a listing to feature:\n\n${lines}\n\nEnter a number (1–${products.length}):`);
    if (raw === null) return null;
    const n = Number(raw.trim());
    if (!Number.isInteger(n) || n < 1 || n > products.length) {
      this.toast.error('Invalid selection.');
      return null;
    }
    return products[n - 1].id;
  }

  busyEquals(token: 'upgrade' | 'portal' | `addon:${string}`): boolean {
    return this.busy === token;
  }
}
