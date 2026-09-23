import { FILL_LEVEL_DEFAULT } from '@atasoif/shared';

import { clampFillLevel, fillLevelFromClientY, fillMotionInstant } from './fill-level';

describe('fill level gesture', () => {
  const rect = { top: 0, bottom: 100, height: 100 };

  it('maps the top of the track to full and the bottom to empty', () => {
    expect(fillLevelFromClientY(0, rect)).toBe(100);
    expect(fillLevelFromClientY(100, rect)).toBe(0);
    expect(fillLevelFromClientY(50, rect)).toBe(50);
  });

  it('clamps a drag that leaves the track', () => {
    expect(fillLevelFromClientY(-40, rect)).toBe(100);
    expect(fillLevelFromClientY(240, rect)).toBe(0);
    expect(clampFillLevel(Number.NaN)).toBe(FILL_LEVEL_DEFAULT);
  });

  it('skips the fill transition while dragging or when motion is reduced', () => {
    expect(fillMotionInstant(true, false)).toBeTrue();
    expect(fillMotionInstant(false, true)).toBeTrue();
    expect(fillMotionInstant(false, false)).toBeFalse();
  });
});
