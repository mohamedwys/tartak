import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private apiUrl = `${environment.apiUrl}/favorites`;

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  toggle(productId: string): Observable<{ favorited: boolean }> {
    return this.http.post<{ favorited: boolean }>(
      `${this.apiUrl}/${productId}`, {}, this.authHeaders()
    );
  }

  getFavoriteIds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/ids`, this.authHeaders());
  }

  getFavorites(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, this.authHeaders());
  }
}
