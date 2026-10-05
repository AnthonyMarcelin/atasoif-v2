import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoreReviewBypass } from './store-review-bypass';

describe('StoreReviewBypass', () => {
  let fixture: ComponentFixture<StoreReviewBypass>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoreReviewBypass],
    }).compileComponents();
    fixture = TestBed.createComponent(StoreReviewBypass);
    fixture.componentInstance.expectedSecret = 'revue-secret';
    fixture.detectChanges();
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

  it('emits when the secret matches', () => {
    const spy = jasmine.createSpy('unlockedOk');
    fixture.componentInstance.unlockedOk.subscribe(spy);
    fixture.componentInstance.unlocked.set(true);
    fixture.componentInstance.secretInput.set('revue-secret');
    fixture.componentInstance.validate();
    expect(spy).toHaveBeenCalled();
  });

  it('rejects a wrong secret', () => {
    fixture.componentInstance.unlocked.set(true);
    fixture.componentInstance.secretInput.set('nope');
    fixture.componentInstance.validate();
    expect(fixture.componentInstance.error()).toBe('Code incorrect.');
  });
});
