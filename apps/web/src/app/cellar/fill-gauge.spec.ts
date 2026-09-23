import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FillGauge } from './fill-gauge';

describe('FillGauge', () => {
  let fixture: ComponentFixture<FillGauge>;
  let gauge: FillGauge;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FillGauge],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FillGauge);
    gauge = fixture.componentInstance;
  });

  function track(): HTMLElement {
    const el = document.createElement('div');
    spyOn(el, 'getBoundingClientRect').and.returnValue({
      top: 0,
      bottom: 100,
      height: 100,
      left: 0,
      right: 48,
      width: 48,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    spyOn(el, 'setPointerCapture');
    spyOn(el, 'hasPointerCapture').and.returnValue(true);
    spyOn(el, 'releasePointerCapture');
    return el;
  }

  function pointer(clientY: number, el: HTMLElement): PointerEvent {
    return {
      button: 0,
      pointerType: 'touch',
      pointerId: 1,
      clientY,
      currentTarget: el,
      preventDefault() {},
    } as unknown as PointerEvent;
  }

  it('does not emit a level when a free user swipes the locked jauge', () => {
    gauge.locked = true;
    gauge.fillLevel = 100;
    fixture.detectChanges();

    const levels: number[] = [];
    const locks: number[] = [];
    gauge.levelChange.subscribe((level) => levels.push(level));
    gauge.lockedGesture.subscribe(() => locks.push(1));

    const el = track();
    gauge.onPointerDown(pointer(20, el));
    gauge.onPointerUp(pointer(80, el));

    expect(levels).toEqual([]);
    expect(locks).toEqual([1]);
    expect(gauge.displayLevel).toBe(100);
    expect(fixture.nativeElement.querySelector('.fill-gauge__track').getAttribute('role')).toBe(
      'img',
    );
  });

  it('emits the dragged level once when the premium gesture ends', () => {
    gauge.locked = false;
    gauge.fillLevel = 100;
    fixture.detectChanges();

    const levels: number[] = [];
    gauge.levelChange.subscribe((level) => levels.push(level));

    const el = track();
    gauge.onPointerDown(pointer(0, el));
    gauge.onPointerMove(pointer(60, el));
    expect(levels).toEqual([]);
    expect(gauge.displayLevel).toBe(40);
    gauge.onPointerUp(pointer(60, el));

    expect(levels).toEqual([40]);
    expect(fixture.nativeElement.querySelector('.fill-gauge__track').getAttribute('role')).toBe(
      'slider',
    );
  });

  it('saves a keyboard step after the gesture settles', fakeAsync(() => {
    gauge.locked = false;
    gauge.fillLevel = 100;
    fixture.detectChanges();

    const levels: number[] = [];
    gauge.levelChange.subscribe((level) => levels.push(level));
    gauge.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(levels).toEqual([]);
    tick(280);
    expect(levels).toEqual([95]);
  }));

  it('drops the fill transition when reduced motion is requested', () => {
    spyOn(window, 'matchMedia').and.returnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    } as MediaQueryList);
    gauge.locked = false;
    gauge.fillLevel = 80;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.fill-gauge__fill').classList.contains('is-instant'),
    ).toBeTrue();
  });
});
