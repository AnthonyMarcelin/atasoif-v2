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
  let router: Router;

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
    router = TestBed.inject(Router);
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

  function enableNativeBiometrics(): void {
    spyOn(biometrics, 'isEnabledPreference').and.returnValue(true);
    Object.assign(biometrics, { isNative: true });
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
    enableNativeBiometrics();
    spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: true });

    const ok = await lock.promptUnlock();

    expect(ok).toBeTrue();
    expect(gate.locked()).toBeFalse();
    expect(auth.getAccessToken()).toBe('tok-lock');
  });

  it('keeps the token and reveals login when Face ID is cancelled', async () => {
    login();
    enableNativeBiometrics();
    spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: false, reason: 'cancelled' });

    const ok = await lock.promptUnlock();

    expect(ok).toBeFalse();
    expect(gate.locked()).toBeTrue();
    expect(gate.cover()).toBeFalse();
    expect(auth.getAccessToken()).toBe('tok-lock');
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/cave' },
    });
  });

  it('fail-opens to login when there is no bearer token', async () => {
    enableNativeBiometrics();
    spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: true });

    const ok = await lock.promptUnlock();

    expect(ok).toBeFalse();
    expect(gate.locked()).toBeTrue();
    expect(gate.cover()).toBeFalse();
    expect(biometrics.verifyUnlock).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/cave' },
    });
  });

  it('cold start lands on login before Face ID (no blank cover-only shell)', async () => {
    login();
    enableNativeBiometrics();
    spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: false, reason: 'cancelled' });

    await lock.start();

    // Sync path before deferred Face ID: login route, no cover-only blank shell.
    expect(gate.cover()).toBeFalse();
    expect(gate.locked()).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/cave' },
    });
    expect(biometrics.verifyUnlock).not.toHaveBeenCalled();
  });

  it('on background soft-locks to login without covering a cave route', () => {
    login();
    enableNativeBiometrics();

    lock.handleAppStateForTests(false);

    expect(gate.locked()).toBeTrue();
    expect(gate.cover()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/cave' },
    });
  });

  it('does not re-lock after Face ID success when the biometric sheet backgrounds the app', async () => {
    login();
    enableNativeBiometrics();
    spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: true });

    await lock.promptUnlock();
    expect(gate.locked()).toBeFalse();

    // Face ID dismissal fires inactive → active; must not start another unlock loop.
    lock.handleAppStateForTests(false);
    expect(gate.locked()).toBeFalse();
    lock.handleAppStateForTests(true);
    expect(gate.locked()).toBeFalse();
    expect(biometrics.verifyUnlock).toHaveBeenCalledTimes(1);
  });

  it('does not auto Face ID again after password fail-open', async () => {
    login();
    enableNativeBiometrics();
    spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: false, reason: 'cancelled' });

    await lock.promptUnlock();
    expect(gate.cover()).toBeFalse();
    expect(biometrics.verifyUnlock).toHaveBeenCalledTimes(1);

    lock.handleAppStateForTests(false);
    expect(gate.cover()).toBeFalse();
    lock.handleAppStateForTests(true);
    expect(biometrics.verifyUnlock).toHaveBeenCalledTimes(1);
  });

  it('fail-opens to login when Face ID times out', async () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-01-01T00:00:00Z'));
      login();
      enableNativeBiometrics();
      spyOn(biometrics, 'verifyUnlock').and.returnValue(new Promise(() => undefined));

      const pending = lock.promptUnlock();
      expect(gate.cover()).toBeTrue();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/cave' },
      });

      jasmine.clock().tick(8_100);
      const ok = await pending;

      expect(ok).toBeFalse();
      expect(gate.cover()).toBeFalse();
      expect(gate.locked()).toBeTrue();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('prompts Face ID again on resume after a real background soft-lock', async () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-01-01T00:00:00Z'));

      login();
      enableNativeBiometrics();
      spyOn(biometrics, 'verifyUnlock').and.resolveTo({ ok: true });

      await lock.promptUnlock();
      expect(gate.locked()).toBeFalse();

      jasmine.clock().tick(2_100);

      lock.handleAppStateForTests(false);
      expect(gate.locked()).toBeTrue();
      expect(gate.cover()).toBeFalse();

      const resumed = lock.promptUnlock();
      jasmine.clock().tick(0);
      await resumed;

      expect(biometrics.verifyUnlock).toHaveBeenCalledTimes(2);
      expect(gate.locked()).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
