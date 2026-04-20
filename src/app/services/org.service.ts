import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  type: 'b2c' | 'b2b' | 'both';
  kybStatus: string;
  taxId: string | null;
  billingAddress: Record<string, any> | null;
  logoUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  website: string | null;
  supportEmail: string | null;
  phone: string | null;
  memberCount?: number;
  myRole?: 'owner' | 'admin' | 'manager' | 'agent';
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  orgId: string;
  userId: string;
  role: 'owner' | 'admin' | 'manager' | 'agent';
  invitedAt: string;
  acceptedAt: string | null;
  status: 'accepted' | 'pending';
  user: { _id: string; name: string; avatarUrl: string | null; createdAt: string } | null;
  email: string | null;
}

export interface CreateOrgPayload {
  name: string;
  type: 'b2c' | 'b2b' | 'both';
  taxId?: string | null;
  phone?: string | null;
  billingAddress?: {
    street?: string | null;
    city?: string | null;
    country?: string | null;
    postal?: string | null;
  } | null;
  bio?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OrgService {
  private apiUrl = `${environment.apiUrl}/orgs`;
  private userApiUrl = `${environment.apiUrl}/user`;

  constructor(private http: HttpClient) {}

  private authHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('token');
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) };
  }

  createOrg(payload: CreateOrgPayload): Observable<Organization> {
    return this.http.post<Organization>(this.apiUrl, payload, this.authHeaders());
  }

  getMyOrgs(): Observable<Organization[]> {
    return this.http.get<Organization[]>(`${this.apiUrl}/mine`, this.authHeaders());
  }

  getOrg(orgId: string): Observable<Organization> {
    return this.http.get<Organization>(`${this.apiUrl}/${orgId}`, this.authHeaders());
  }

  updateOrg(orgId: string, patch: Partial<CreateOrgPayload> & { logoUrl?: string | null; coverUrl?: string | null; website?: string | null; supportEmail?: string | null }): Observable<Organization> {
    return this.http.patch<Organization>(`${this.apiUrl}/${orgId}`, patch, this.authHeaders());
  }

  deleteOrg(orgId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${orgId}`, this.authHeaders());
  }

  inviteMember(orgId: string, payload: { email: string; role: 'admin' | 'manager' | 'agent' }): Observable<OrgMember> {
    return this.http.post<OrgMember>(`${this.apiUrl}/${orgId}/members/invite`, payload, this.authHeaders());
  }

  acceptInvite(orgId: string): Observable<OrgMember> {
    return this.http.post<OrgMember>(`${this.apiUrl}/${orgId}/members/accept`, {}, this.authHeaders());
  }

  changeMemberRole(orgId: string, userId: string, role: 'admin' | 'manager' | 'agent'): Observable<OrgMember> {
    return this.http.patch<OrgMember>(`${this.apiUrl}/${orgId}/members/${userId}`, { role }, this.authHeaders());
  }

  removeMember(orgId: string, userId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${orgId}/members/${userId}`, this.authHeaders());
  }

  listMembers(orgId: string): Observable<OrgMember[]> {
    return this.http.get<OrgMember[]>(`${this.apiUrl}/${orgId}/members`, this.authHeaders());
  }

  // Swaps the active org context server-side and stores the new JWT locally
  // so every subsequent request carries the updated currentOrgId claim.
  switchOrg(orgId: string | null): Observable<{ token: string; user: any }> {
    return this.http
      .post<{ token: string; user: any }>(`${this.userApiUrl}/switch-org`, { orgId }, this.authHeaders())
      .pipe(tap((res) => {
        if (res?.token) localStorage.setItem('token', res.token);
      }));
  }
}
