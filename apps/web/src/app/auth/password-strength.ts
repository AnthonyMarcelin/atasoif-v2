export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  label: string;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { level: 0, label: '' };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  const level = Math.min(score, 4) as PasswordStrengthLevel;
  const labels: Record<PasswordStrengthLevel, string> = {
    0: '',
    1: 'FAIBLE',
    2: 'MOYEN',
    3: 'SOLIDE',
    4: 'EXCELLENT',
  };

  return { level, label: labels[level] };
}
