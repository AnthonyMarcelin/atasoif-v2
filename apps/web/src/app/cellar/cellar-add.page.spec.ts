import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CatalogService } from './catalog.service';
import { CellarAddPage } from './cellar-add.page';
import type { CatalogBottle, CreateUserBottlePayload } from './cellar.types';
import { CollectionService } from './collection.service';

describe('CellarAddPage wine fields', () => {
  let fixture: ComponentFixture<CellarAddPage>;
  let page: CellarAddPage;
  let create: jasmine.Spy;

  function wineBottle(): CatalogBottle {
    return {
      id: 9,
      name: 'Château Example',
      brand: 'Example',
      origin: null,
      abv: null,
      volumeMl: null,
      barcode: null,
      photoUrl: null,
      attrs: { appellation: 'Margaux', grape: 'Merlot' },
      categoryId: 2,
      category: { id: 2, slug: 'wine', name: 'Vin' },
    };
  }

  beforeEach(async () => {
    create = jasmine.createSpy('create').and.returnValue(
      of({
        data: { id: 1 },
        meta: { freemium: { count: 1, limit: 10, remaining: 9, entitlement: false } },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [CellarAddPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CatalogService,
          useValue: {
            categories: () =>
              of([
                { id: 1, slug: 'whisky', name: 'Whisky' },
                { id: 2, slug: 'wine', name: 'Vin' },
              ]),
            search: () => of({ data: [] }),
            lookupBarcode: () => of(wineBottle()),
          },
        },
        {
          provide: CollectionService,
          useValue: {
            freemium: () => of({ count: 0, limit: 10, remaining: 10, entitlement: false }),
            create,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CellarAddPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows wine fields only when the miss category is wine', () => {
    page.searchControl.setValue('chinon');
    page.startMiss();
    page.form.controls.categoryId.setValue(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#add-appellation')).toBeNull();

    page.form.controls.categoryId.setValue(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#add-appellation')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#add-grape')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#add-vintage')).not.toBeNull();
  });

  it('sends a wine override on a catalog hit and hides the fields for whisky', () => {
    page.pickHit(wineBottle());
    fixture.detectChanges();
    expect(page.form.controls.appellation.value).toBe('Margaux');
    expect(fixture.nativeElement.querySelector('#add-appellation')).not.toBeNull();

    page.form.controls.appellation.setValue('Pauillac');
    page.form.controls.boughtAt.setValue('Cave');
    page.onSubmit();

    const payload = create.calls.mostRecent().args[0] as CreateUserBottlePayload;
    expect(payload.bottleId).toBe(9);
    expect(payload.attrsOverride).toEqual({
      appellation: 'Pauillac',
      grape: null,
      vintage: null,
    });

    page.pickHit({
      ...wineBottle(),
      attrs: {},
      categoryId: 1,
      category: { id: 1, slug: 'whisky', name: 'Whisky' },
    });
    fixture.detectChanges();
    page.form.controls.boughtAt.setValue('Nicolas');
    page.onSubmit();

    const whisky = create.calls.mostRecent().args[0] as CreateUserBottlePayload;
    expect(whisky.attrsOverride).toBeUndefined();
    expect(fixture.nativeElement.querySelector('#add-appellation')).toBeNull();
  });

  it('puts wine keys on the catalog bottle for a manual miss', () => {
    page.searchControl.setValue('chinon maison');
    page.startMiss();
    page.form.controls.categoryId.setValue(2);
    page.form.controls.appellation.setValue('Chinon');
    page.form.controls.grape.setValue('Cabernet franc');
    page.form.controls.vintage.setValue('2018');
    page.form.controls.boughtAt.setValue('Producteur');
    page.onSubmit();

    const payload = create.calls.mostRecent().args[0] as CreateUserBottlePayload;
    expect(payload.bottle?.attrs).toEqual({
      appellation: 'Chinon',
      grape: 'Cabernet franc',
      vintage: '2018',
    });
    expect(payload.attrsOverride).toBeUndefined();
  });
});
