import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { emailVerifiedGuard } from './email-verified.guard';
import { environment } from '../../../environments/environment';

const verifiedUser = {
  id: 1,
  email: 'a@b.c',
  fullName: null,
  pseudo: 'soif',
  isPublic: false,
  emailVerified: true,
};

const unverifiedUser = { ...verifiedUser, emailVerified: false };

describe('emailVerifiedGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), AuthService],
    });
  });

  afterEach(() => localStorage.clear());

  it('allows activation when email is verified', () => {
    const auth = TestBed.inject(AuthService);
    const httpMock = TestBed.inject(HttpTestingController);

    auth.login({ email: 'a@b.c', password: 'x' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`).flush({
      data: { type: 'bearer', token: 'tok', user: verifiedUser },
    });

    const result = TestBed.runInInjectionContext(() =>
      emailVerifiedGuard({} as never, { url: '/me' } as never),
    );
    expect(result).toBeTrue();
    httpMock.verify();
  });

  it('redirects to verify-email when session is unverified', () => {
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const httpMock = TestBed.inject(HttpTestingController);

    auth.login({ email: 'a@b.c', password: 'x' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`).flush({
      data: { type: 'bearer', token: 'tok', user: unverifiedUser },
    });

    const result = TestBed.runInInjectionContext(() =>
      emailVerifiedGuard({} as never, { url: '/me' } as never),
    );
    expect(result).toEqual(
      router.createUrlTree(['/auth/verify-email'], { queryParams: { returnUrl: '/me' } }),
    );
    httpMock.verify();
  });
});
