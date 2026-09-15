/** Auth user shape returned by Adonis `/api/v1/account/profile` and auth responses. */
export interface AuthUser {
  id: number;
  email: string;
  fullName: string | null;
  pseudo: string | null;
  isPublic: boolean;
  emailVerified: boolean;
}

export interface AuthTokenResponse {
  type: 'bearer';
  token: string;
  user: AuthUser;
}

export interface ApiDataEnvelope<T> {
  data: T;
}
