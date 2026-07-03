import { Component } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CommonModule] ,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  constructor(private authService: AuthService) {}
  successMessage = '';
  errorMessage = '';
  loginForm= new FormGroup({
    email: new FormControl('', [
      Validators.required,
      Validators.email
    ]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6)
    ])
  });
  onSubmit() {

    if (this.loginForm.invalid) {
      return;
    }

    this.authService.login(this.loginForm.value)
      .subscribe({
        
        next: (response: any) => {
          localStorage.setItem(
            'access_token',
            response.access_token
          );
          localStorage.setItem(
            'refresh_token',
            response.refresh_token
          );
          this.successMessage = 'Login successful';
          this.errorMessage = '';
          console.log(response);
        },

        error: (error) => {
          this.successMessage = '';
          this.errorMessage = 'Invalid credentials';
          console.error(error);
        }
      });
  }
}
