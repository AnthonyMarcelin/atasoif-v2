import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        AuthService,
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('attaches Authorization Bearer header when a token is present', () => {
    auth.login({ email: 'a@b.c', password: 'x' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`).flush({
      data: {
        type: 'bearer',
        token: 'tok-123',
        user: {
          id: 1,
          email: 'a@b.c',
          fullName: null,
          pseudo: null,
          isPublic: false,
          emailVerified: false,
        },
      },
    });

    http.get(`${environment.apiBaseUrl}/api/v1/account/profile`).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/account/profile`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-123');
    req.flush({
      data: {
        id: 1,
        email: 'a@b.c',
        fullName: null,
        pseudo: null,
        isPublic: false,
        emailVerified: false,
      },
    });
  });

  it('clears session on 401 for protected API calls', () => {
    const handleSpy = spyOn(auth, 'handleUnauthorized').and.callThrough();

    auth.login({ email: 'a@b.c', password: 'x' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`).flush({
      data: {
        type: 'bearer',
        token: 'tok-123',
        user: {
          id: 1,
          email: 'a@b.c',
          fullName: null,
          pseudo: null,
          isPublic: false,
          emailVerified: false,
        },
      },
    });

    http.get(`${environment.apiBaseUrl}/api/v1/account/profile`).subscribe({
      error: () => undefined,
    });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/account/profile`);
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(handleSpy).toHaveBeenCalled();
    expect(auth.getAccessToken()).toBeNull();
  });

  it('keeps session and routes to verify-email on E_EMAIL_UNVERIFIED', () => {
    const handleSpy = spyOn(auth, 'handleEmailUnverified').and.callThrough();

    auth.login({ email: 'a@b.c', password: 'x' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`).flush({
      data: {
        type: 'bearer',
        token: 'tok-123',
        user: {
          id: 1,
          email: 'a@b.c',
          fullName: null,
          pseudo: null,
          isPublic: false,
          emailVerified: false,
        },
      },
    });

    http.patch(`${environment.apiBaseUrl}/api/v1/account/profile`, {}).subscribe({
      error: () => undefined,
    });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/account/profile`);
    req.flush(
      { code: 'E_EMAIL_UNVERIFIED', message: 'Confirme ton e-mail pour continuer' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(handleSpy).toHaveBeenCalled();
    expect(auth.getAccessToken()).toBe('tok-123');
  });
});
