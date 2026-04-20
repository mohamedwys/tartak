import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface CategoryNode {
  _id: string;
  slug: string;
  name: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder: number;
  children: CategoryNode[];
}

export interface CategoryDetailResponse {
  category: {
    _id: string;
    slug: string;
    name: string;
    icon?: string | null;
    parentId?: string | null;
    sortOrder: number;
  };
  parent: { _id: string; slug: string; name: string } | null;
  ancestors: { _id: string; slug: string; name: string }[];
  children: CategoryNode[];
  descendantIds: string[];
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private apiUrl = `${environment.apiUrl}/categories`;

  // ReplaySubject caches the tree for the session. A single fetch, shared by
  // every component that asks for it — keeps the Pro-mode navbar snappy.
  private treeCache$ = new ReplaySubject<CategoryNode[]>(1);
  private treeLoaded = false;
  private flatBySlug: Map<string, CategoryNode> | null = null;
  private flatById:   Map<string, CategoryNode> | null = null;

  constructor(private http: HttpClient) {}

  getTree(): Observable<CategoryNode[]> {
    if (!this.treeLoaded) {
      this.treeLoaded = true;
      const startedAt = performance.now();
      this.http.get<CategoryNode[]>(this.apiUrl).pipe(
        tap(tree => {
          const elapsed = performance.now() - startedAt;
          if (elapsed > 200) {
            // Warn but proceed — optimization is a follow-up.
            console.warn(`[CategoryService] tree fetch took ${elapsed.toFixed(0)}ms`);
          }
          this.indexTree(tree);
        }),
      ).subscribe({
        next: tree => this.treeCache$.next(tree),
        error: err => {
          this.treeLoaded = false;
          this.treeCache$.error(err);
        },
      });
    }
    return this.treeCache$.asObservable();
  }

  getBySlug(slug: string): Observable<CategoryDetailResponse> {
    return this.http.get<CategoryDetailResponse>(`${this.apiUrl}/${slug}`);
  }

  // Sync lookup — returns null until the tree has resolved at least once.
  findBySlug(slug: string): CategoryNode | null {
    return this.flatBySlug?.get(slug) ?? null;
  }

  findById(id: string): CategoryNode | null {
    return this.flatById?.get(id) ?? null;
  }

  // Ancestors root-first, excluding the node itself. Uses the cached tree
  // so the product-detail breadcrumb doesn't need another network round-trip.
  ancestorsOf(id: string): CategoryNode[] {
    const out: CategoryNode[] = [];
    let cur = this.flatById?.get(id) ?? null;
    if (!cur) return out;
    while (cur.parentId) {
      const p = this.flatById?.get(cur.parentId) ?? null;
      if (!p) break;
      out.unshift(p);
      cur = p;
    }
    return out;
  }

  private indexTree(tree: CategoryNode[]): void {
    const bySlug = new Map<string, CategoryNode>();
    const byId   = new Map<string, CategoryNode>();
    const walk = (nodes: CategoryNode[]): void => {
      for (const n of nodes) {
        bySlug.set(n.slug, n);
        byId.set(n._id, n);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(tree);
    this.flatBySlug = bySlug;
    this.flatById = byId;
  }
}
