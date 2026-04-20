import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
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
import { ToastComponent } from './components/toast/toast.component';
import { ImageUploadComponent } from './components/image-upload/image-upload.component';
import { TimeAgoPipe } from './pipes/time-ago.pipe';
import { AuthGuard } from './guards/auth.guard';

@NgModule({
  declarations: [
    AppComponent,
    ProductListComponent,
    ProductDetailComponent,
    LoginComponent,
    RegisterComponent,
    AddProductComponent,
    EditProductComponent,
    InboxComponent,
    ConversationComponent,
    SellerProfileComponent,
    EditProfileComponent,
    VerifyEmailComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent,
    OnboardingBusinessComponent,
    ToastComponent,
    ImageUploadComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule, HttpClientModule, CommonModule, TimeAgoPipe],
  providers: [AuthGuard],
  bootstrap: [AppComponent]
})
export class AppModule {}
