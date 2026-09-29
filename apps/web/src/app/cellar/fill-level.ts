import { FILL_LEVEL_DEFAULT, FILL_LEVEL_MAX, FILL_LEVEL_MIN } from '@atasoif/shared';

export interface FillTrackRect {
  top: number;
  bottom: number;
  height: number;
}

/** Percent 0-100. Non-finite values fall back to the schema default. */
export function clampFillLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return FILL_LEVEL_DEFAULT;
  }
  return Math.min(FILL_LEVEL_MAX, Math.max(FILL_LEVEL_MIN, Math.round(value)));
}

/**
 * Map a vertical pointer to fill percent.
 * The amber fill grows from the bottom, so a higher finger means a higher level.
 */
export function fillLevelFromClientY(clientY: number, rect: FillTrackRect): number {
  const height = rect.height > 0 ? rect.height : rect.bottom - rect.top;
  if (height <= 0) {
    return FILL_LEVEL_DEFAULT;
  }
  const ratio = (rect.bottom - clientY) / height;
  return clampFillLevel(ratio * 100);
}

/** Drag tracking and reduced-motion both skip the decorative fill transition. */
export function fillMotionInstant(dragging: boolean, reduceMotion: boolean): boolean {
  return dragging || reduceMotion;
}
