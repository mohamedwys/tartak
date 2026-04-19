import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private apiUrl = `${environment.apiUrl}/messages`;

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  sendMessage(data: { recipientId: string; productId: string; content: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, data, this.authHeaders());
  }

  getInbox(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/inbox`, this.authHeaders());
  }

  getConversation(userId: string, productId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/conversation/${userId}/${productId}`,
      this.authHeaders()
    );
  }

  markConversationRead(userId: string, productId: string): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/conversation/${userId}/${productId}/read`,
      {},
      this.authHeaders()
    );
  }
}
