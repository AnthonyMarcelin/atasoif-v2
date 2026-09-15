import { evaluatePasswordStrength } from './password-strength';
import {
  controlErrorMessage,
  emailValidators,
  passwordValidators,
  passwordsMatchValidator,
} from './auth-validators';
import { FormControl, FormGroup } from '@angular/forms';

describe('evaluatePasswordStrength', () => {
  it('returns empty strength for blank password', () => {
    expect(evaluatePasswordStrength('')).toEqual({ level: 0, label: '' });
  });

  it('scores a solid password', () => {
    const result = evaluatePasswordStrength('CaveNocturne12');
    expect(result.level).toBeGreaterThanOrEqual(3);
    expect(result.label).toBeTruthy();
  });
});

describe('auth validators', () => {
  it('requires a valid email', () => {
    const control = new FormControl('', emailValidators);
    expect(control.valid).toBeFalse();
    control.setValue('pas-un-email');
    expect(control.valid).toBeFalse();
    control.setValue('toi@atasoif.fr');
    expect(control.valid).toBeTrue();
  });

  it('enforces password length 8–32', () => {
    const control = new FormControl('', passwordValidators);
    control.setValue('court');
    expect(control.hasError('minlength')).toBeTrue();
    control.setValue('assezlong');
    expect(control.valid).toBeTrue();
  });

  it('detects password mismatch', () => {
    const group = new FormGroup(
      {
        password: new FormControl('abcdefgh'),
        passwordConfirmation: new FormControl('abcdefgh!'),
      },
      { validators: passwordsMatchValidator },
    );
    expect(group.hasError('passwordsMismatch')).toBeTrue();
  });

  it('builds French field errors after touch', () => {
    const control = new FormControl('', emailValidators);
    expect(controlErrorMessage(control, "L'e-mail")).toBeNull();
    control.markAsTouched();
    expect(controlErrorMessage(control, "L'e-mail")).toContain('requis');
  });
});
