import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Banner {
  _id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  bgColor: string | null;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
}

export interface Tile {
  _id: string;
  label: string;
  iconUrl: string | null;
  targetUrl: string;
  sortOrder: number;
}

export interface FeaturedStorefront {
  _id: string;
  name: string;
  slug: string;
  type: string;
  kybStatus: string;
  logoUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
}

export interface HomeResponse {
  banners: Banner[];
  tiles: Tile[];
  featured: {
    trending: any[];
    featuredStorefronts: FeaturedStorefront[];
  };
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class HomeService {
  private apiUrl = `${environment.apiUrl}/home`;
  private cache$: ReplaySubject<HomeResponse> | null = null;
  private cachedAt = 0;

  constructor(private http: HttpClient) {}

  getHome(): Observable<HomeResponse> {
    const fresh = this.cache$ && (Date.now() - this.cachedAt) < FIVE_MINUTES_MS;
    if (fresh) return this.cache$!.asObservable();

    this.cache$ = new ReplaySubject<HomeResponse>(1);
    this.cachedAt = Date.now();
    const subject = this.cache$;
    this.http.get<HomeResponse>(this.apiUrl).subscribe({
      next: (res) => subject.next(res),
      error: (err) => {
        // Invalidate so the next caller retries instead of replaying the error forever.
        this.cache$ = null;
        this.cachedAt = 0;
        subject.error(err);
      },
    });
    return subject.asObservable();
  }
}
