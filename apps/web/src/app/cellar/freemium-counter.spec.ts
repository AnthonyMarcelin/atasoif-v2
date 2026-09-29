import { ComponentFixture, TestBed } from '@angular/core/testing';

import { cellarEmptyKind, FreemiumCounter } from './freemium-counter';

describe('freemium counter', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FreemiumCounter],
    }).compileComponents();
  });

  it('shows lifetime creates from freemium meta', () => {
    const fixture: ComponentFixture<FreemiumCounter> = TestBed.createComponent(FreemiumCounter);
    fixture.componentInstance.freemium = {
      count: 7,
      limit: 10,
      remaining: 3,
      entitlement: false,
    };
    fixture.detectChanges();

    const root = fixture.nativeElement.querySelector('.freemium-counter') as HTMLElement;
    expect(root.textContent).toContain('7/10');
    expect(root.getAttribute('aria-label')).toContain('7 sur 10');
    expect(root.getAttribute('aria-label')).not.toContain('0 sur');
  });

  it('treats an empty list after deletes as a full lifetime cap', () => {
    expect(
      cellarEmptyKind({ count: 10, limit: 10, remaining: 0, entitlement: false }),
    ).toBe('full');
    expect(
      cellarEmptyKind({ count: 4, limit: 10, remaining: 6, entitlement: false }),
    ).toBe('again');
    expect(
      cellarEmptyKind({ count: 0, limit: 10, remaining: 10, entitlement: false }),
    ).toBe('first');
    expect(
      cellarEmptyKind({ count: 12, limit: 10, remaining: null, entitlement: true }),
    ).toBe('again');
  });
});
