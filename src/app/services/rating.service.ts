import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RatingService {
  private apiUrl = `${environment.apiUrl}/ratings`;

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  submitRating(data: { sellerId: string; stars: number; comment?: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, data, this.authHeaders());
  }

  getSellerRatings(sellerId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/seller/${sellerId}`);
  }
}
