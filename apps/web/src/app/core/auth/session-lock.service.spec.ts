import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { BiometricAuthService } from './biometric-auth.service';
import { SessionGate } from './session-gate';
import { SessionLockService } from './session-lock.service';

describe('SessionLockService', () => {
  let lock: SessionLockService;
  let auth: AuthService;
  let httpMock: HttpTestingController;
  let gate: SessionGate;
  let biometrics: BiometricAuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    lock = TestBed.inject(SessionLockService);
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    gate = TestBed.inject(SessionGate);
    biometrics = TestBed.inject(BiometricAuthService);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function login(): void {
    auth.login({ email: 'a@b.c', password: 'x' }).subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/login`).flush({
      data: {
        type: 'bearer',
        token: 'tok-lock',
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
  }

  it('does not lock when biometrics are off', async () => {
    login();
    spyOn(biometrics, 'isEnabledPreference').and.returnValue(false);
    Object.assign(biometrics, { isNative: true });

    expect(lock.shouldLock()).toBeFalse();
    await lock.promptUnlock();
    expect(gate.locked()).toBeFalse();
    expect(auth.getAccessToken()).toBe('tok-lock');
  });

  it('unlocks the existing token after a successful Face ID check', async () => {
    login();
    spyOn(biometrics, 'isEnabledPreference').and.returnValue(true);
    Object.assign(biometrics, { isNative: true });
    spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: true });

    const ok = await lock.promptUnlock();

    expect(ok).toBeTrue();
    expect(gate.locked()).toBeFalse();
    expect(auth.getAccessToken()).toBe('tok-lock');
  });

  it('keeps the token and reveals login when Face ID is cancelled', async () => {
    login();
    spyOn(biometrics, 'isEnabledPreference').and.returnValue(true);
    Object.assign(biometrics, { isNative: true });
    spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: false, reason: 'cancelled' });

    const ok = await lock.promptUnlock();

    expect(ok).toBeFalse();
    expect(gate.locked()).toBeTrue();
    expect(gate.cover()).toBeFalse();
    expect(auth.getAccessToken()).toBe('tok-lock');
  });
});
