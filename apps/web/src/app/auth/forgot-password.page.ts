import { NgClass } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { controlErrorMessage, emailValidators } from './auth-validators';

@Component({
  selector: 'app-forgot-password-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.page.html',
})
export class ForgotPasswordPage {
  private readonly fb = new FormBuilder().nonNullable;

  readonly submittedOk = signal(false);
  readonly focusedField = signal<string | null>(null);

  readonly form = this.fb.group({
    email: ['', emailValidators],
  });

  errorForEmail(): string | null {
    return controlErrorMessage(this.form.controls.email, "L'e-mail");
  }

  onSubmit(): void {
    this.submittedOk.set(false);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.submittedOk.set(true);
  }

  setFocused(field: string | null): void {
    this.focusedField.set(field);
  }

  fieldClass(): Record<string, boolean> {
    const control = this.form.controls.email;
    return {
      'auth-field': true,
      'is-focused': this.focusedField() === 'email',
      'is-invalid': !!(control.touched && control.invalid),
    };
  }
}
