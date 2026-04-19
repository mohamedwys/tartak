import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  submitting = false;
  done = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) { this.error = 'Invalid reset link.'; }
  }

  submit(): void {
    if (this.password.length < 6) { this.error = 'Password must be at least 6 characters.'; return; }
    if (this.password !== this.confirmPassword) { this.error = 'Passwords do not match.'; return; }
    this.submitting = true;
    this.error = '';
    this.userService.resetPassword(this.token, this.password).subscribe({
      next: () => { this.done = true; this.submitting = false; },
      error: (err: any) => { this.error = err.error?.message ?? 'Reset failed.'; this.submitting = false; }
    });
  }
}
