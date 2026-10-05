import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth/auth.service';
import { StoreReviewBypass } from './store-review-bypass';

describe('StoreReviewBypass', () => {
  let fixture: ComponentFixture<StoreReviewBypass>;
  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoreReviewBypass],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), AuthService],
    }).compileComponents();
    fixture = TestBed.createComponent(StoreReviewBypass);
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reveals the secret field after 7 taps within 5s', () => {
    const logo = fixture.nativeElement.querySelector('.store-review__logo') as HTMLButtonElement;
    expect(fixture.componentInstance.unlocked()).toBe(false);
    for (let i = 0; i < 7; i++) {
      logo.click();
    }
    fixture.detectChanges();
    expect(fixture.componentInstance.unlocked()).toBe(true);
    expect(fixture.nativeElement.querySelector('#store-review-secret')).toBeTruthy();
  });

  it('calls the API and emits when the secret is accepted', () => {
    const spy = jasmine.createSpy('unlockedOk');
    fixture.componentInstance.unlockedOk.subscribe(spy);
    fixture.componentInstance.unlocked.set(true);
    fixture.componentInstance.secretInput.set('revue-secret');
    fixture.componentInstance.validate();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/v1/auth/store-review`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ secret: 'revue-secret' });
    req.flush({ ok: true });

    expect(spy).toHaveBeenCalled();
  });

  it('shows an error when the API rejects the secret', () => {
    spyOn(auth, 'validateStoreReview').and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { message: 'Code revue invalide' },
          }),
      ),
    );
    fixture.componentInstance.unlocked.set(true);
    fixture.componentInstance.secretInput.set('nope');
    fixture.componentInstance.validate();
    expect(fixture.componentInstance.error()).toBe('Code revue invalide');
  });

  it('does not call the API when the input is empty', () => {
    spyOn(auth, 'validateStoreReview').and.returnValue(of({ ok: true }));
    fixture.componentInstance.unlocked.set(true);
    fixture.componentInstance.secretInput.set('   ');
    fixture.componentInstance.validate();
    expect(auth.validateStoreReview).not.toHaveBeenCalled();
  });
});
