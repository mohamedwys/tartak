import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OfferService {
  private apiUrl = `${environment.apiUrl}/offers`;

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  makeOffer(data: { productId: string; amount: number; message?: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, data, this.authHeaders());
  }

  getMyOffers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mine`, this.authHeaders());
  }

  getOffersForProduct(productId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/product/${productId}`, this.authHeaders());
  }

  respond(offerId: string, status: 'accepted' | 'declined'): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${offerId}`, { status }, this.authHeaders());
  }
}
