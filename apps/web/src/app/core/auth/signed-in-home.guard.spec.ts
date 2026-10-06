import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { signedInHomeGuard } from './signed-in-home.guard';

describe('signedInHomeGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), AuthService],
    });
  });

  afterEach(() => localStorage.clear());

  it('allows the welcome page when anonymous', () => {
    const result = TestBed.runInInjectionContext(() => signedInHomeGuard({} as never, {} as never));
    expect(result).toBeTrue();
  });

  it('sends a stored session to the cave', () => {
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
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
          emailVerified: true,
        },
      },
    });

    const result = TestBed.runInInjectionContext(() => signedInHomeGuard({} as never, {} as never));
    expect(result).toEqual(router.createUrlTree(['/cave']));
    httpMock.verify();
  });
});
