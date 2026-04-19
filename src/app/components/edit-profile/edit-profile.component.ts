import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.css']
})
export class EditProfileComponent implements OnInit {
  name = '';
  avatarUrl = '';
  submitting = false;
  error = '';
  success = '';

  constructor(private userService: UserService, private router: Router) {}

  ngOnInit(): void {
    // Pre-populate from JWT payload (name not available in token, just id/email)
    // Leave blank — user can type their new name
  }

  saveProfile(): void {
    if (!this.name.trim()) { this.error = 'Name is required.'; return; }
    this.submitting = true;
    this.error = '';
    this.success = '';
    const data: { name: string; avatarUrl?: string } = { name: this.name.trim() };
    if (this.avatarUrl.trim()) data.avatarUrl = this.avatarUrl.trim();
    this.userService.updateProfile(data).subscribe({
      next: () => { this.success = 'Profile updated!'; this.submitting = false; },
      error: (err: any) => {
        this.error = err.error?.message ?? 'Failed to update profile.';
        this.submitting = false;
      }
    });
  }
}
