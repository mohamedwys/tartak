import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { decodeJwtPayload } from '../utils/jwt';

@Injectable({ providedIn: 'root' })
export class DashboardGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    if (!this.auth.isLoggedIn()) {
      return this.router.parseUrl('/login');
    }
    const payload = decodeJwtPayload<{ id?: string; currentOrgId?: string | null }>(
      localStorage.getItem('token'),
    );
    if (!payload?.currentOrgId) {
      return this.router.parseUrl('/onboarding/business');
    }
    return true;
  }
}
