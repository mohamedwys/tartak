import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  password: string = '';

  constructor(private authService: AuthService, private router: Router, private toastService: ToastService) { }

  loginAsDemo(email: string, password: string) {
    this.email = email;
    this.password = password;
    this.login();
  }

  login() {
    const user = { email: this.email, password: this.password };
    this.authService.login(user).subscribe({
      next: (response: any) => {
        localStorage.setItem('token', response.token);
        this.toastService.success('Login successful!');
        this.router.navigate(['/']);
      },
      error: (error: any) => {
        this.toastService.error(error.error?.message ?? 'Login failed');
      }
    });
  }
}
