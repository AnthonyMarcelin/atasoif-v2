import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { CellarDetailPage } from './cellar-detail.page';
import { CollectionService } from './collection.service';
import type { FreemiumMeta, UpdateUserBottlePayload, UserBottle } from './cellar.types';

const freeMeta: FreemiumMeta = { count: 4, limit: 10, remaining: 6, entitlement: false };
const premiumMeta: FreemiumMeta = { count: 4, limit: 10, remaining: null, entitlement: true };

function bottle(fillLevel = 100): UserBottle {
  return {
    id: 4,
    userId: 1,
    bottleId: 2,
    nameOverride: null,
    brandOverride: null,
    originOverride: null,
    abvOverride: null,
    volumeMlOverride: null,
    photoUrlOverride: null,
    attrsOverride: null,
    note: null,
    review: 'Tourbé',
    pricePaid: 42,
    boughtAt: 'Nicolas',
    fillLevel,
    fillLevelUpdatesCount: 0,
    isPublic: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
    bottle: {
      id: 2,
      name: 'Lagavulin',
      brand: 'Lagavulin',
      origin: null,
      abv: null,
      volumeMl: null,
      barcode: null,
      photoUrl: 'https://example.com/lag.jpg',
      attrs: {},
      categoryId: 1,
      category: { id: 1, slug: 'whisky', name: 'Whisky' },
    },
  };
}

describe('CellarDetailPage premium gates', () => {
  const state: { freemium: FreemiumMeta; row: UserBottle } = {
    freemium: freeMeta,
    row: bottle(),
  };
  let update: jasmine.Spy;
  let uploadPhoto: jasmine.Spy;
  let fixture: ComponentFixture<CellarDetailPage>;
  let page: CellarDetailPage;
  let router: Router;

  beforeEach(async () => {
    state.freemium = freeMeta;
    state.row = bottle();
    update = jasmine.createSpy('update').and.callFake((_id: number, payload: UpdateUserBottlePayload) =>
      of({
        data: {
          ...state.row,
          ...payload,
          fillLevel: payload.fillLevel ?? state.row.fillLevel,
          fillLevelUpdatesCount: payload.fillLevel !== undefined ? 1 : state.row.fillLevelUpdatesCount,
        },
        meta: { freemium: state.freemium },
      }),
    );
    uploadPhoto = jasmine.createSpy('uploadPhoto').and.callFake(() =>
      of({
        data: state.row,
        meta: { freemium: state.freemium },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [CellarDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '4' }) } },
        },
        {
          provide: CollectionService,
          useValue: {
            get: () => of({ data: state.row, meta: { freemium: state.freemium } }),
            update,
            uploadPhoto,
            delete: () => of({ data: { id: 4, deleted: true }, meta: { freemium: state.freemium } }),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(CellarDetailPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps a free swipe and a free photo off the write APIs', () => {
    page.onFillLevel(40);
    page.submitShelfPhoto(new File([new Uint8Array([1])], 'moi.webp', { type: 'image/webp' }));

    expect(update).not.toHaveBeenCalled();
    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/cave/premium'], {
      queryParams: { reason: 'jauge' },
    });
    expect(router.navigate).toHaveBeenCalledWith(['/cave/premium'], {
      queryParams: { reason: 'photo' },
    });
    expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
  });

  it('saves a premium level with fillLevel only and uploads an allowed photo', () => {
    state.freemium = premiumMeta;
    page.freemium.set(premiumMeta);
    fixture.detectChanges();

    page.onFillLevel(40);
    expect(update).toHaveBeenCalledWith(4, { fillLevel: 40 });
    expect(page.entry()?.fillLevel).toBe(40);
    expect(page.entry()?.fillLevelUpdatesCount).toBe(1);

    const file = new File([new Uint8Array([1, 2])], 'moi.webp', { type: 'image/webp' });
    page.submitShelfPhoto(file);
    expect(uploadPhoto).toHaveBeenCalledWith(4, file);

    page.submitShelfPhoto(new File([new Uint8Array([1])], 'moi.gif', { type: 'image/gif' }));
    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    expect(page.photoError()).toContain('webp');
    expect(fixture.nativeElement.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('persists the free memory fields without fillLevel or a photo override', () => {
    page.startEdit();
    page.onSave();

    expect(update).toHaveBeenCalled();
    const payload = update.calls.mostRecent().args[1] as UpdateUserBottlePayload;
    expect(payload.boughtAt).toBe('Nicolas');
    expect(payload.pricePaid).toBe(42);
    expect(payload.fillLevel).toBeUndefined();
    expect('photoUrlOverride' in payload).toBeFalse();
  });
});
