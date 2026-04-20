import { Component, OnInit } from '@angular/core';
import { OrgService, StorefrontUpdatePayload } from '../../services/org.service';
import { ToastService } from '../../services/toast.service';
import { decodeJwtPayload } from '../../utils/jwt';

@Component({
  selector: 'app-dashboard-storefront',
  templateUrl: './storefront.component.html',
  styleUrls: ['./storefront.component.css'],
})
export class DashboardStorefrontComponent implements OnInit {
  orgId = '';
  orgName = '';
  savedSlug = '';
  loading = true;
  saving = false;
  error = '';
  serverError = '';

  // Form model
  slug = '';
  logoUrl = '';
  coverUrl = '';
  primaryColor = '#1b2332';
  accentColor = '#FF6B35';
  bannerStyle: 'solid' | 'image' = 'solid';
  seoTitle = '';
  seoDescription = '';
  seoOgImage = '';
  policyShipping = '';
  policyReturns = '';
  policyContact = '';

  slugError = '';

  constructor(private orgService: OrgService, private toast: ToastService) {}

  ngOnInit(): void {
    const payload = decodeJwtPayload<{ currentOrgId?: string | null }>(localStorage.getItem('token'));
    this.orgId = payload?.currentOrgId ?? '';
    if (!this.orgId) {
      this.error = 'No active organization.';
      this.loading = false;
      return;
    }
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.orgService.getOrgStorefront(this.orgId).subscribe({
      next: (res) => {
        this.orgName = res.org.name;
        this.savedSlug = res.storefront.slug ?? res.org.slug ?? '';
        this.slug = this.savedSlug;
        this.logoUrl = res.org.logoUrl ?? '';
        this.coverUrl = res.org.coverUrl ?? '';
        this.primaryColor = res.storefront.theme?.primaryColor ?? '#1b2332';
        this.accentColor = res.storefront.theme?.accentColor ?? '#FF6B35';
        this.bannerStyle = res.storefront.theme?.bannerStyle ?? 'solid';
        this.seoTitle = res.storefront.seo?.title ?? '';
        this.seoDescription = res.storefront.seo?.description ?? '';
        this.seoOgImage = res.storefront.seo?.ogImage ?? '';
        this.policyShipping = res.storefront.policies?.shipping ?? '';
        this.policyReturns = res.storefront.policies?.returns ?? '';
        this.policyContact = res.storefront.policies?.contact ?? '';
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load your storefront.';
        this.loading = false;
      },
    });
  }

  onSlugChange(value: string): void {
    const normalized = (value || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    this.slug = normalized;
    if (!normalized) {
      this.slugError = 'Slug is required.';
    } else if (normalized.length < 3) {
      this.slugError = 'Slug must be at least 3 characters.';
    } else if (normalized.length > 48) {
      this.slugError = 'Slug must be 48 characters or fewer.';
    } else {
      this.slugError = '';
    }
  }

  openPreview(): void {
    const target = this.slug || this.savedSlug;
    if (!target) return;
    if (this.slug && this.slug !== this.savedSlug) {
      const cont = confirm(
        'Your slug has unsaved changes. The preview URL only works after you save. Open anyway?',
      );
      if (!cont) return;
    }
    window.open(`/store/${encodeURIComponent(target)}`, '_blank', 'noopener');
  }

  save(): void {
    if (this.slugError) return;
    if (this.saving) return;

    const payload: StorefrontUpdatePayload = {
      theme: {
        primaryColor: this.primaryColor,
        accentColor: this.accentColor,
        bannerStyle: this.bannerStyle,
      },
      seo: {
        ...(this.seoTitle ? { title: this.seoTitle } : {}),
        ...(this.seoDescription ? { description: this.seoDescription } : {}),
        ...(this.seoOgImage ? { ogImage: this.seoOgImage } : {}),
      },
      policies: {
        ...(this.policyShipping ? { shipping: this.policyShipping } : {}),
        ...(this.policyReturns ? { returns: this.policyReturns } : {}),
        ...(this.policyContact ? { contact: this.policyContact } : {}),
      },
    };

    if (this.slug && this.slug !== this.savedSlug) {
      payload.slug = this.slug;
    }
    if (this.logoUrl) payload.logoUrl = this.logoUrl;
    if (this.coverUrl) payload.coverUrl = this.coverUrl;

    this.saving = true;
    this.serverError = '';
    this.orgService.updateOrgStorefront(this.orgId, payload).subscribe({
      next: (res) => {
        this.savedSlug = res.storefront.slug ?? res.org.slug ?? '';
        this.slug = this.savedSlug;
        this.orgName = res.org.name;
        this.saving = false;
        this.toast.success('Storefront saved.');
      },
      error: (err) => {
        this.saving = false;
        this.serverError = err?.error?.message ?? 'Failed to save storefront.';
        this.toast.error(this.serverError);
      },
    });
  }
}
