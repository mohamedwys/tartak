import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CheckoutUrlResponse {
  url: string;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private apiUrl = `${environment.apiUrl}/billing`;

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  startSubscriptionCheckout(orgId: string): Observable<CheckoutUrlResponse> {
    return this.http.post<CheckoutUrlResponse>(
      `${this.apiUrl}/checkout/subscription`,
      { orgId },
      this.authHeaders(),
    );
  }

  startAddonCheckout(
    orgId: string,
    addonSlug: string,
    productId?: string,
  ): Observable<CheckoutUrlResponse> {
    const body: { orgId: string; addonSlug: string; productId?: string } = { orgId, addonSlug };
    if (productId) body.productId = productId;
    return this.http.post<CheckoutUrlResponse>(
      `${this.apiUrl}/checkout/addon`,
      body,
      this.authHeaders(),
    );
  }

  openBillingPortal(orgId: string): Observable<CheckoutUrlResponse> {
    return this.http.post<CheckoutUrlResponse>(
      `${this.apiUrl}/portal`,
      { orgId },
      this.authHeaders(),
    );
  }
}
