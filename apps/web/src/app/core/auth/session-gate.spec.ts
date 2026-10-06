import { TestBed } from '@angular/core/testing';

import { SessionGate } from './session-gate';

describe('SessionGate', () => {
  let gate: SessionGate;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    gate = TestBed.inject(SessionGate);
  });

  it('starts unlocked', () => {
    expect(gate.locked()).toBeFalse();
    expect(gate.cover()).toBeFalse();
  });

  it('covers the cave while Face ID runs', () => {
    gate.requireUnlock();
    expect(gate.locked()).toBeTrue();
    expect(gate.cover()).toBeTrue();
  });

  it('keeps the lock after a password fallback without covering login', () => {
    gate.requireUnlock();
    gate.revealLogin();
    expect(gate.locked()).toBeTrue();
    expect(gate.cover()).toBeFalse();
  });

  it('clears both flags on unlock', () => {
    gate.requireUnlock();
    gate.unlock();
    expect(gate.locked()).toBeFalse();
    expect(gate.cover()).toBeFalse();
  });
});
