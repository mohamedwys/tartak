import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.css']
})
export class VerifyEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  message = '';

  constructor(private route: ActivatedRoute, private userService: UserService) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) { this.status = 'error'; this.message = 'No verification token provided.'; return; }
    this.userService.verifyEmail(token).subscribe({
      next: (res) => { this.status = 'success'; this.message = res.message ?? 'Email verified!'; },
      error: (err) => { this.status = 'error'; this.message = err.error?.message ?? 'Verification failed.'; }
    });
  }
}
