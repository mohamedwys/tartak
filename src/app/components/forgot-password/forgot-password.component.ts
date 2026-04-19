import { Component } from '@angular/core';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  email = '';
  submitting = false;
  done = false;
  error = '';

  constructor(private userService: UserService) {}

  submit(): void {
    if (!this.email.trim()) { this.error = 'Please enter your email.'; return; }
    this.submitting = true;
    this.error = '';
    this.userService.forgotPassword(this.email.trim()).subscribe({
      next: () => { this.done = true; this.submitting = false; },
      error: () => { this.done = true; this.submitting = false; } // always show success (no enumeration)
    });
  }
}
