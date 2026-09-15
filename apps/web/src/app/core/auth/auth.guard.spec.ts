import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';
import { environment } from '../../../environments/environment';
import { HttpTestingController } from '@angular/common/http/testing';

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), AuthService],
    });
  });

  afterEach(() => localStorage.clear());

  it('allows activation when authenticated', () => {
    const auth = TestBed.inject(AuthService);
    const httpMock = TestBed.inject(HttpTestingController);

    auth.login({ email: 'a@b.c', password: 'x' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`).flush({
      data: {
        type: 'bearer',
        token: 'tok',
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

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/me' } as never),
    );
    expect(result).toBeTrue();
    httpMock.verify();
  });

  it('redirects to login when anonymous', () => {
    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/cellar' } as never),
    );
    expect(result).toEqual(
      router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: '/cellar' } }),
    );
  });
});
