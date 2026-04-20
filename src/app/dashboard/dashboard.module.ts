import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardShellComponent } from './dashboard-shell/dashboard-shell.component';
import { OverviewComponent } from './overview/overview.component';
import { CatalogComponent } from './catalog/catalog.component';
import { InquiriesComponent } from './inquiries/inquiries.component';
import { ComingSoonComponent } from './coming-soon/coming-soon.component';
import { DashboardStorefrontComponent } from './storefront/storefront.component';
import { ImageUploadComponent } from '../components/image-upload/image-upload.component';
import { TimeAgoPipe } from '../pipes/time-ago.pipe';

@NgModule({
  declarations: [
    DashboardShellComponent,
    OverviewComponent,
    CatalogComponent,
    InquiriesComponent,
    ComingSoonComponent,
    DashboardStorefrontComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    DashboardRoutingModule,
    TimeAgoPipe,
    ImageUploadComponent,
  ],
})
export class DashboardModule {}
