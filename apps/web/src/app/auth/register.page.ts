import { NgClass } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthTabs } from './auth-tabs';
import {
  controlErrorMessage,
  emailValidators,
  passwordValidators,
  passwordsMatchValidator,
  pseudoValidators,
} from './auth-validators';
import { evaluatePasswordStrength } from './password-strength';

@Component({
  selector: 'app-register-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink, AuthTabs],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly fb = new FormBuilder().nonNullable;

  readonly showPassword = signal(false);
  readonly submittedOk = signal(false);
  readonly focusedField = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      pseudo: ['', pseudoValidators],
      email: ['', emailValidators],
      password: ['', passwordValidators],
      passwordConfirmation: ['', passwordValidators],
    },
    { validators: passwordsMatchValidator },
  );

  strength() {
    return evaluatePasswordStrength(this.form.controls.password.value);
  }

  errorFor(name: 'pseudo' | 'email' | 'password' | 'passwordConfirmation'): string | null {
    const labels = {
      pseudo: 'Le pseudo',
      email: "L'e-mail",
      password: 'Le mot de passe',
      passwordConfirmation: 'La confirmation',
    } as const;
    return controlErrorMessage(this.form.controls[name], labels[name]);
  }

  mismatchError(): string | null {
    const confirmation = this.form.controls.passwordConfirmation;
    if (!confirmation.touched || !this.form.hasError('passwordsMismatch')) {
      return null;
    }
    return 'Les mots de passe ne correspondent pas.';
  }

  onSubmit(): void {
    this.submittedOk.set(false);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    // API wiring lands in E1-T05 — shell only validates locally.
    this.submittedOk.set(true);
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  setFocused(field: string | null): void {
    this.focusedField.set(field);
  }

  fieldClass(name: string): Record<string, boolean> {
    const control = this.form.get(name);
    return {
      'auth-field': true,
      'is-focused': this.focusedField() === name,
      'is-invalid': !!(control && control.touched && control.invalid),
    };
  }
}
