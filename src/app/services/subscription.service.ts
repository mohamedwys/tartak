import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PlanFeatures {
  listing_limit?: number | null;
  verified_badge?: boolean;
  advanced_analytics?: boolean;
  priority_support?: boolean;
  [key: string]: any;
}

export interface SubscriptionPlan {
  _id: string;
  slug: 'free' | 'pro' | string;
  name: string;
  priceMinor: number;
  currency: string;
  billingInterval: 'month' | 'year' | 'one_time';
  features: PlanFeatures;
  sortOrder: number;
}

export interface AddonService {
  _id: string;
  slug: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  type: 'one_time' | 'recurring';
  durationDays: number | null;
  features: Record<string, any>;
  sortOrder: number;
}

export interface OrgSubscriptionResponse {
  org: { _id: string; name: string; slug: string };
  plan: SubscriptionPlan;
  subscription: {
    status: 'active' | 'cancelled' | 'past_due' | 'trialing';
    startedAt: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasBillingProfile: boolean;
  };
  usage: {
    activeListings: number;
    listingLimit: number | null;
  };
}

export interface OrgAddon {
  _id: string;
  addonSlug: string;
  status: 'active' | 'expired' | 'cancelled';
  startedAt: string;
  endsAt: string | null;
  productId: string | null;
  isActive?: boolean;
}

// Plain string because Intl.NumberFormat doesn't ship a MAD symbol on
// every locale we care about — rolling our own keeps output consistent
// between MAD today and whatever currencies get added later.
export function formatPrice(priceMinor: number, currency: string): string {
  const major = Math.round(priceMinor) / 100;
  // Drop trailing zeros so "350.00 MAD" reads as "350 MAD".
  const rounded = Number.isInteger(major) ? major.toString() : major.toFixed(2);
  return `${rounded} ${currency}`;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private apiUrl = environment.apiUrl;

  // Simple in-memory cache for the public catalog endpoints. Both lists
  // are tiny (2 plans, a handful of add-ons) and change rarely, so a
  // session-scoped cache avoids re-hitting the API across route changes.
  private cache = new Map<string, any>();

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  getPlans(): Observable<SubscriptionPlan[]> {
    const cached = this.cache.get('plans') as SubscriptionPlan[] | undefined;
    if (cached) return of(cached);
    return this.http
      .get<SubscriptionPlan[]>(`${this.apiUrl}/subscription-plans`)
      .pipe(tap((rows) => this.cache.set('plans', rows)));
  }

  getAddons(): Observable<AddonService[]> {
    const cached = this.cache.get('addons') as AddonService[] | undefined;
    if (cached) return of(cached);
    return this.http
      .get<AddonService[]>(`${this.apiUrl}/addon-services`)
      .pipe(tap((rows) => this.cache.set('addons', rows)));
  }

  getOrgSubscription(orgId: string): Observable<OrgSubscriptionResponse> {
    return this.http.get<OrgSubscriptionResponse>(
      `${this.apiUrl}/orgs/${orgId}/subscription`,
      this.authHeaders(),
    );
  }

  getOrgAddons(orgId: string): Observable<OrgAddon[]> {
    return this.http.get<OrgAddon[]>(
      `${this.apiUrl}/orgs/${orgId}/addons`,
      this.authHeaders(),
    );
  }
}
