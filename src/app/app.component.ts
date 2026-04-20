import { Component, HostListener, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { MessageService } from './services/message.service';
import { OrgService, Organization } from './services/org.service';
import { decodeJwtPayload } from './utils/jwt';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'E-Commerce Site';
  unreadCount = 0;
  myId = '';
  myInitials = '';
  currentOrgId: string | null = null;
  myOrgs: Organization[] = [];
  accountMenuOpen = false;
  private onboardingCheckedFor = '';

  constructor(
    private authService: AuthService,
    private messageService: MessageService,
    private orgService: OrgService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.refresh();

    // Re-run on every navigation so login/logout switches pick up the new token
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.refresh());
  }

  private refresh(): void {
    if (!this.authService.isLoggedIn()) {
      this.unreadCount = 0;
      this.myId = '';
      this.myInitials = '';
      this.currentOrgId = null;
      this.myOrgs = [];
      this.onboardingCheckedFor = '';
      return;
    }
    const payload = decodeJwtPayload<{ id?: string; name?: string; email?: string; currentOrgId?: string | null }>(
      localStorage.getItem('token'),
    );
    if (!payload) return;
    const newId = payload.id ?? '';
    this.currentOrgId = payload.currentOrgId ?? null;

    if (newId !== this.myId) {
      this.myId = newId;
      const name: string = payload.name ?? payload.email ?? '';
      this.myInitials = name
        .split(' ')
        .map((w: string) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      this.loadUnreadCount();
      this.loadMyOrgs();
    }
  }

  private loadUnreadCount(): void {
    this.messageService.getInbox().subscribe({
      next: (threads: any[]) => {
        this.unreadCount = threads.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0);
      },
      error: () => {}
    });
  }

  private loadMyOrgs(): void {
    this.orgService.getMyOrgs().subscribe({
      next: (orgs) => {
        this.myOrgs = orgs ?? [];
        this.maybeNudgeOnboarding();
      },
      error: () => { this.myOrgs = []; }
    });
  }

  // One-time nudge: business-account users with no orgs land on onboarding.
  // We rely on the profile endpoint to read accountType since the JWT only
  // carries id/email/currentOrgId.
  private maybeNudgeOnboarding(): void {
    if (!this.myId || this.onboardingCheckedFor === this.myId) return;
    if (this.currentOrgId) return;
    if (this.myOrgs.length > 0) return;
    if (this.router.url.startsWith('/onboarding/business')) return;

    this.onboardingCheckedFor = this.myId;

    this.authService.getMyAccountType().subscribe({
      next: (accountType) => {
        if (accountType === 'business') {
          this.router.navigate(['/onboarding/business']);
        }
      },
      error: () => {}
    });
  }

  orgName(orgId: string | null): string {
    if (!orgId) return 'Personal';
    const match = this.myOrgs.find((o) => o._id === orgId);
    return match?.name ?? 'Personal';
  }

  currentContextLabel(): string {
    return this.orgName(this.currentOrgId);
  }

  toggleAccountMenu(event?: Event): void {
    event?.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
  }

  @HostListener('document:click')
  closeMenus(): void {
    this.accountMenuOpen = false;
  }

  switchTo(orgId: string | null): void {
    if (orgId === this.currentOrgId) {
      this.accountMenuOpen = false;
      return;
    }
    this.orgService.switchOrg(orgId).subscribe({
      next: () => {
        this.accountMenuOpen = false;
        // Reload so user-scoped data is re-fetched under the new context.
        window.location.reload();
      },
      error: () => {
        this.accountMenuOpen = false;
      }
    });
  }

  goCreateBusiness(): void {
    this.accountMenuOpen = false;
    this.router.navigate(['/onboarding/business']);
  }

  logout(): void {
    this.authService.logout();
    window.location.href = '/';
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }
}
