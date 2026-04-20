import { Component, OnInit } from '@angular/core';
import { OrgService, Organization } from '../../services/org.service';
import { decodeJwtPayload } from '../../utils/jwt';

interface NavItem {
  label: string;
  route?: string;
  stub?: string; // for coming-soon: the key describing the section
  implemented: boolean;
}

@Component({
  selector: 'app-dashboard-shell',
  templateUrl: './dashboard-shell.component.html',
  styleUrls: ['./dashboard-shell.component.css'],
})
export class DashboardShellComponent implements OnInit {
  org: Organization | null = null;
  currentOrgId: string | null = null;
  myInitials = '';

  navItems: NavItem[] = [
    { label: 'Overview',   route: 'overview',  implemented: true },
    { label: 'Catalog',    route: 'catalog',   implemented: true },
    { label: 'Inquiries',  route: 'inquiries', implemented: true },
    { label: 'Messages',   route: 'messages',   stub: 'messages',   implemented: false },
    { label: 'Offers',     route: 'offers',     stub: 'offers',     implemented: false },
    { label: 'Customers',  route: 'customers',  stub: 'customers',  implemented: false },
    { label: 'Promotions', route: 'promotions', stub: 'promotions', implemented: false },
    { label: 'Plan',       route: 'plan',       implemented: true },
    { label: 'Storefront', route: 'storefront', implemented: true },
    { label: 'Team',       route: 'team',       stub: 'team',       implemented: false },
    { label: 'Settings',   route: 'settings',   stub: 'settings',   implemented: false },
  ];

  constructor(private orgService: OrgService) {}

  ngOnInit(): void {
    const payload = decodeJwtPayload<{ id?: string; name?: string; email?: string; currentOrgId?: string | null }>(
      localStorage.getItem('token'),
    );
    this.currentOrgId = payload?.currentOrgId ?? null;
    const name = payload?.name ?? payload?.email ?? '';
    this.myInitials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

    if (this.currentOrgId) {
      this.orgService.getOrg(this.currentOrgId).subscribe({
        next: (org) => { this.org = org; },
        error: () => {},
      });
    }
  }
}
