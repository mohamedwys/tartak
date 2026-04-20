import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { OrgService, CreateOrgPayload } from '../../services/org.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-onboarding-business',
  templateUrl: './onboarding-business.component.html',
  styleUrls: ['./onboarding-business.component.css']
})
export class OnboardingBusinessComponent {
  name = '';
  type: 'b2c' | 'b2b' | 'both' = 'b2c';
  taxId = '';
  phone = '';
  street = '';
  city = '';
  country = '';
  postal = '';
  bio = '';

  submitting = false;

  constructor(
    private orgService: OrgService,
    private router: Router,
    private toast: ToastService,
  ) {}

  submit(): void {
    if (!this.name.trim()) {
      this.toast.error('Organization name is required.');
      return;
    }
    this.submitting = true;

    const billing = {
      street: this.street.trim() || null,
      city: this.city.trim() || null,
      country: this.country.trim() || null,
      postal: this.postal.trim() || null,
    };
    const hasBilling = Object.values(billing).some((v) => !!v);

    const payload: CreateOrgPayload = {
      name: this.name.trim(),
      type: this.type,
      taxId: this.taxId.trim() || null,
      phone: this.phone.trim() || null,
      billingAddress: hasBilling ? billing : null,
      bio: this.bio.trim() || null,
    };

    this.orgService.createOrg(payload).subscribe({
      next: (org) => {
        this.orgService.switchOrg(org._id).subscribe({
          next: () => {
            this.toast.success(`Welcome, ${org.name}!`);
            this.router.navigate(['/']);
          },
          error: () => {
            // Org was created successfully even if the context-switch failed.
            this.toast.success('Business account created.');
            this.router.navigate(['/']);
          },
        });
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error(err.error?.message ?? 'Failed to create business account.');
      },
    });
  }
}
