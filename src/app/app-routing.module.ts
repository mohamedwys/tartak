import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductListComponent } from './components/product-list/product-list.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AddProductComponent } from './components/add-product/add-product.component';
import { EditProductComponent } from './components/edit-product/edit-product.component';
import { InboxComponent } from './components/inbox/inbox.component';
import { ConversationComponent } from './components/conversation/conversation.component';
import { SellerProfileComponent } from './components/seller-profile/seller-profile.component';
import { EditProfileComponent } from './components/edit-profile/edit-profile.component';
import { VerifyEmailComponent } from './components/verify-email/verify-email.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { OnboardingBusinessComponent } from './components/onboarding-business/onboarding-business.component';
import { StorefrontComponent } from './components/storefront/storefront.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '',                              component: ProductListComponent },
  { path: 'product/:id',                   component: ProductDetailComponent },
  { path: 'login',                         component: LoginComponent },
  { path: 'register',                      component: RegisterComponent },
  { path: 'add-product',                   component: AddProductComponent,   canActivate: [AuthGuard] },
  { path: 'edit-product/:id',              component: EditProductComponent,   canActivate: [AuthGuard] },
  { path: 'inbox',                         component: InboxComponent,         canActivate: [AuthGuard] },
  { path: 'conversation/:userId/:productId', component: ConversationComponent, canActivate: [AuthGuard] },
  { path: 'seller/:id',                    component: SellerProfileComponent },
  { path: 'store/:slug',                   component: StorefrontComponent },
  { path: 'profile/edit',                  component: EditProfileComponent,   canActivate: [AuthGuard] },
  { path: 'verify-email',                  component: VerifyEmailComponent },
  { path: 'forgot-password',               component: ForgotPasswordComponent },
  { path: 'reset-password/:token',         component: ResetPasswordComponent },
  { path: 'onboarding/business',           component: OnboardingBusinessComponent, canActivate: [AuthGuard] },
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard/dashboard.module').then((m) => m.DashboardModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
