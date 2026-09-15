import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { apiErrorMessage } from '../core/auth/api-error';
import { AuthService } from '../core/auth/auth.service';
import { controlErrorMessage, emailValidators } from './auth-validators';

@Component({
  selector: 'app-forgot-password-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.page.html',
})
export class ForgotPasswordPage {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly auth = inject(AuthService);

  readonly submittedOk = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly focusedField = signal<string | null>(null);

  readonly form = this.fb.group({
    email: ['', emailValidators],
  });

  errorForEmail(): string | null {
    return controlErrorMessage(this.form.controls.email, "L'e-mail");
  }

  onSubmit(): void {
    this.submittedOk.set(false);
    this.formError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.auth
      .forgotPassword(this.form.controls.email.value)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.submittedOk.set(true),
        error: (err: unknown) => {
          this.formError.set(
            apiErrorMessage(err, "Envoi impossible pour le moment. Réessaie plus tard."),
          );
        },
      });
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
