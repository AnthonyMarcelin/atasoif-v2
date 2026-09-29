import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

/** Matches Adonis signup/login email rules (max 254). */
export const emailValidators = [Validators.required, Validators.email, Validators.maxLength(254)];

/** Matches Adonis password rules: 8–32 characters. */
export const passwordValidators = [
  Validators.required,
  Validators.minLength(8),
  Validators.maxLength(32),
];

export const pseudoValidators = [
  Validators.required,
  Validators.minLength(2),
  Validators.maxLength(32),
  Validators.pattern(/^[a-zA-Z0-9._-]+$/),
];

export function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('passwordConfirmation')?.value;
  if (!password || !confirmation) {
    return null;
  }
  return password === confirmation ? null : { passwordsMismatch: true };
}

export function controlErrorMessage(
  control: AbstractControl | null,
  fieldLabel: string,
): string | null {
  if (!control || !control.touched || !control.errors) {
    return null;
  }

  if (control.errors['required']) {
    return `${fieldLabel} est requis.`;
  }
  if (control.errors['email']) {
    return 'Indique une adresse e-mail valide.';
  }
  if (control.errors['minlength']) {
    const min = control.errors['minlength'].requiredLength as number;
    return `${fieldLabel} · au moins ${min} caractères.`;
  }
  if (control.errors['maxlength']) {
    const max = control.errors['maxlength'].requiredLength as number;
    return `${fieldLabel} · maximum ${max} caractères.`;
  }
  if (control.errors['pattern']) {
    return `${fieldLabel} · lettres, chiffres, . _ - uniquement.`;
  }
  return `${fieldLabel} est invalide.`;
}
