import { Component, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, FormGroupDirective} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, CommonModule, RouterLink, MatIconModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent {
  constructor(private authService: AuthService) {}
  successMessage = '';
  errorMessage = '';

  // the <form [formGroup]> directive; resetting through it also clears its "submitted" state
  @ViewChild(FormGroupDirective) formDirective!: FormGroupDirective;

  signupForm = new FormGroup({
    username: new FormControl('', [
      Validators.required
    ]),

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
    if (this.signupForm.invalid) {
      return;
    }

    this.authService.signup(this.signupForm.value)
      .subscribe({
        next: (response: any) => {
          this.successMessage = response.message;
          this.errorMessage = '';
          // signupForm.reset() alone would leave the form marked as submitted,
          // so the now-empty fields would show "required" errors under the success message
          this.formDirective.resetForm();
        },

        error: (error) => {
          this.successMessage = '';
          this.errorMessage = 'Signup failed';
          console.error(error);
        }
      });
  }

}
