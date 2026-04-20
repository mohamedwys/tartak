import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  name: string = '';
  email: string = '';
  password: string = '';
  isBusiness: boolean = false;

  constructor(private authService: AuthService, private router: Router, private toastService: ToastService) {}

  register() {
    const user = { name: this.name, email: this.email, password: this.password };
    this.authService.register(user).subscribe({
      next: (response: any) => {
        localStorage.setItem('token', response.token);
        this.toastService.success('Account created!');
        this.router.navigate([this.isBusiness ? '/onboarding/business' : '/']);
      },
      error: (error: any) => {
        this.toastService.error(error.error?.message ?? 'Registration failed. Please try again.');
      }
    });
  }
}
