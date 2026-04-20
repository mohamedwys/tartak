import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardShellComponent } from './dashboard-shell/dashboard-shell.component';
import { OverviewComponent } from './overview/overview.component';
import { CatalogComponent } from './catalog/catalog.component';
import { InquiriesComponent } from './inquiries/inquiries.component';
import { ComingSoonComponent } from './coming-soon/coming-soon.component';
import { DashboardGuard } from './dashboard.guard';

const routes: Routes = [
  {
    path: '',
    component: DashboardShellComponent,
    canActivate: [DashboardGuard],
    children: [
      { path: '',           pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview',   component: OverviewComponent },
      { path: 'catalog',    component: CatalogComponent },
      { path: 'inquiries',  component: InquiriesComponent },
      { path: 'messages',   component: ComingSoonComponent, data: { stub: 'messages' } },
      { path: 'offers',     component: ComingSoonComponent, data: { stub: 'offers' } },
      { path: 'customers',  component: ComingSoonComponent, data: { stub: 'customers' } },
      { path: 'promotions', component: ComingSoonComponent, data: { stub: 'promotions' } },
      { path: 'storefront', component: ComingSoonComponent, data: { stub: 'storefront' } },
      { path: 'team',       component: ComingSoonComponent, data: { stub: 'team' } },
      { path: 'settings',   component: ComingSoonComponent, data: { stub: 'settings' } },
      { path: '**',         redirectTo: 'overview' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule {}
