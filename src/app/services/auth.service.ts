import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { decodeJwtPayload } from '../utils/jwt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/user`;

  constructor(private http: HttpClient) {}

  register(user: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, user);
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  logout(): void {
    localStorage.removeItem('token');
  }

  // Reads accountType from the public profile endpoint. Used to nudge
  // business users into onboarding; server-side checks remain authoritative.
  getMyAccountType(): Observable<'individual' | 'business' | null> {
    const payload = decodeJwtPayload<{ id?: string }>(localStorage.getItem('token'));
    if (!payload?.id) return of(null);
    return this.http
      .get<{ accountType?: 'individual' | 'business' }>(`${this.apiUrl}/${payload.id}/profile`)
      .pipe(map((p) => p.accountType ?? 'individual'));
  }
}
