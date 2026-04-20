import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ProductStatus = 'draft' | 'active' | 'paused' | 'sold' | 'removed';

export interface DashboardStats {
  activeListings: number;
  totalListings: number;
  newInquiriesToday: number;
  unansweredMessages: number;
  recentListings: any[];
  recentMessages: any[];
}

export interface OrgProductListResponse {
  products: any[];
  total: number;
  page: number;
  pages: number;
}

export interface OrgProductListParams {
  page?: number;
  limit?: number;
  status?: ProductStatus;
  q?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  categoryId?: string;
}

export interface InquiryThread {
  otherUser: { _id: string; name: string; avatarUrl: string | null };
  product: { _id: string; name: string; imageUrl: string; price: number; status: ProductStatus };
  lastMessage: { content: string; createdAt: string; senderId: string; type: string };
  unreadCount: number;
  pendingOffer: { _id: string; amount: number; status: string } | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  getStats(orgId: string): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(
      `${this.apiUrl}/orgs/${orgId}/stats`,
      this.authHeaders(),
    );
  }

  getProducts(orgId: string, params: OrgProductListParams = {}): Observable<OrgProductListResponse> {
    let httpParams = new HttpParams();
    if (params.page)       httpParams = httpParams.set('page', String(params.page));
    if (params.limit)      httpParams = httpParams.set('limit', String(params.limit));
    if (params.status)     httpParams = httpParams.set('status', params.status);
    if (params.q)          httpParams = httpParams.set('q', params.q);
    if (params.sort)       httpParams = httpParams.set('sort', params.sort);
    if (params.categoryId) httpParams = httpParams.set('category_id', params.categoryId);
    return this.http.get<OrgProductListResponse>(
      `${this.apiUrl}/orgs/${orgId}/products`,
      { ...this.authHeaders(), params: httpParams },
    );
  }

  getInquiries(orgId: string): Observable<InquiryThread[]> {
    return this.http.get<InquiryThread[]>(
      `${this.apiUrl}/orgs/${orgId}/inquiries`,
      this.authHeaders(),
    );
  }

  updateStatus(productId: string, status: ProductStatus): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/products/${productId}/status`,
      { status },
      this.authHeaders(),
    );
  }
}
