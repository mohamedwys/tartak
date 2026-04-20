import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private apiUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  getProducts(
    params: Record<string, string | number> = {},
    mode: 'pro' | 'marketplace' | 'all' = 'all',
  ): Observable<{ products: any[]; total: number; page: number; pages: number }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) query.set(k, String(v)); });
    if (mode !== 'all') query.set('mode', mode);
    const url = query.toString() ? `${this.apiUrl}?${query}` : this.apiUrl;
    return this.http.get<{ products: any[]; total: number; page: number; pages: number }>(url);
  }

  getProductsByOwner(ownerId: string): Observable<{ products: any[]; total: number; page: number; pages: number }> {
    return this.http.get<{ products: any[]; total: number; page: number; pages: number }>(`${this.apiUrl}?ownerId=${ownerId}`);
  }

  getProductById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createProduct(product: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, product, this.authHeaders());
  }

  updateProduct(id: string, product: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, product, this.authHeaders());
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, this.authHeaders());
  }

  markAsSold(id: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/sold`, {}, this.authHeaders());
  }

  getSellerProfile(userId: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/user/${userId}/profile`);
  }

  getSimilarProducts(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${id}/similar`);
  }
}
