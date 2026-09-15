import { NgClass } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthTabs } from './auth-tabs';
import { controlErrorMessage, emailValidators, passwordValidators } from './auth-validators';

@Component({
  selector: 'app-login-page',
  imports: [NgClass, ReactiveFormsModule, RouterLink, AuthTabs],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly fb = new FormBuilder().nonNullable;

  readonly showPassword = signal(false);
  readonly submittedOk = signal(false);
  readonly focusedField = signal<string | null>(null);

  readonly form = this.fb.group({
    email: ['', emailValidators],
    password: ['', passwordValidators],
  });

  errorFor(name: 'email' | 'password'): string | null {
    const labels = {
      email: "L'e-mail",
      password: 'Le mot de passe',
    } as const;
    return controlErrorMessage(this.form.controls[name], labels[name]);
  }

  onSubmit(): void {
    this.submittedOk.set(false);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
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
