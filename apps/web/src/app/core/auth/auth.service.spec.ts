import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage';

const sampleUser = {
  id: 1,
  email: 'a@b.c',
  fullName: null,
  pseudo: 'soif',
  isPublic: false,
  emailVerified: false,
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let storage: TokenStorage;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), AuthService],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(TokenStorage);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('stores bearer token after login', () => {
    service.login({ email: 'a@b.c', password: 'motdepasse1' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({
      data: { type: 'bearer', token: 'tok-abc', user: sampleUser },
    });

    expect(service.getAccessToken()).toBe('tok-abc');
    expect(storage.getToken()).toBe('tok-abc');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('clears session on logout', () => {
    service.login({ email: 'a@b.c', password: 'motdepasse1' }).subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`)
      .flush({ data: { type: 'bearer', token: 'tok-xyz', user: sampleUser } });

    service.logout().subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/account/logout`);
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'ok' });

    expect(service.getAccessToken()).toBeNull();
    expect(storage.getToken()).toBeNull();
  });

  it('handleUnauthorized clears token and navigates to login', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    service.login({ email: 'a@b.c', password: 'motdepasse1' }).subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`)
      .flush({ data: { type: 'bearer', token: 'stale', user: sampleUser } });

    service.handleUnauthorized('/me');

    expect(service.getAccessToken()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/me' },
    });
  });

  it('updates stored user after profile patch', () => {
    service.login({ email: 'a@b.c', password: 'motdepasse1' }).subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`)
      .flush({ data: { type: 'bearer', token: 'tok-prof', user: sampleUser } });

    const updated = { ...sampleUser, emailVerified: true, pseudo: 'nouveau', isPublic: true };
    service.updateProfile({ pseudo: 'nouveau', isPublic: true }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/account/profile`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ pseudo: 'nouveau', isPublic: true });
    req.flush({ data: updated });

    expect(service.user()?.pseudo).toBe('nouveau');
    expect(service.user()?.isPublic).toBeTrue();
  });

  it('postAuthPath sends unverified users to verify-email', () => {
    service.login({ email: 'a@b.c', password: 'motdepasse1' }).subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`)
      .flush({ data: { type: 'bearer', token: 'tok', user: sampleUser } });

    expect(service.postAuthPath('/me')).toBe('/auth/verify-email');
  });

  it('verifyEmail updates the session user when logged in', () => {
    service.login({ email: 'a@b.c', password: 'motdepasse1' }).subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`)
      .flush({ data: { type: 'bearer', token: 'tok', user: sampleUser } });

    service.verifyEmail('verify-token').subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/email/verify`);
    expect(req.request.method).toBe('POST');
    req.flush({ data: { ...sampleUser, emailVerified: true } });

    expect(service.isEmailVerified()).toBeTrue();
    expect(service.postAuthPath()).toBe('/cave');
    expect(service.postAuthPath('/me')).toBe('/me');
  });

  it('handleEmailUnverified keeps the token and navigates to verify-email', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);

    service.login({ email: 'a@b.c', password: 'motdepasse1' }).subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`)
      .flush({ data: { type: 'bearer', token: 'tok', user: sampleUser } });

    service.handleEmailUnverified('/me');

    expect(service.getAccessToken()).toBe('tok');
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/verify-email'], {
      queryParams: { returnUrl: '/me' },
    });
  });

  it('builds the Google Ally redirect URL', () => {
    expect(service.googleAuthUrl()).toBe(`${environment.apiBaseUrl}/api/v1/auth/google/redirect`);
  });

  it('builds the Facebook Ally redirect URL', () => {
    expect(service.facebookAuthUrl()).toBe(
      `${environment.apiBaseUrl}/api/v1/auth/facebook/redirect`,
    );
  });

  it('completeOAuthLogin stores the token then loads the profile', () => {
    service.completeOAuthLogin('oauth-tok').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/account/profile`);
    expect(req.request.headers.get('Authorization')).toBeNull();
    // Interceptor not mounted in this TestBed — token is still stored for later calls.
    expect(service.getAccessToken()).toBe('oauth-tok');
    req.flush({
      data: { ...sampleUser, emailVerified: true },
    });
    expect(service.user()?.emailVerified).toBeTrue();
  });
});
