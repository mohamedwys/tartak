import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private uploadUrl = `${environment.apiUrl}/upload`;
  private baseUrl = environment.apiUrl.replace(/\/api$/, '');

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post<{ url: string }>(this.uploadUrl, formData, { headers: this.authHeaders().headers }).pipe(
      map(response => ({
        // Absolute URLs (e.g. Supabase Storage public URLs) pass through; legacy
        // relative paths are prefixed with the API host.
        url: /^https?:\/\//i.test(response.url) ? response.url : this.baseUrl + response.url,
      }))
    );
  }
}
