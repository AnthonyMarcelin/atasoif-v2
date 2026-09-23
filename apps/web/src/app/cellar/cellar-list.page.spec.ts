import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CellarListPage } from './cellar-list.page';
import { CollectionService } from './collection.service';

describe('CellarListPage filters', () => {
  it('offers cognac, vodka and liqueur as well as the original chips', async () => {
    await TestBed.configureTestingModule({
      imports: [CellarListPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CollectionService,
          useValue: {
            list: () =>
              of({
                data: [],
                meta: {
                  freemium: { count: 0, limit: 10, remaining: 10, entitlement: false },
                },
              }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CellarListPage);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Whisky');
    expect(text).toContain('Cognac');
    expect(text).toContain('Vodka');
    expect(text).toContain('Liqueur');
    expect(text).toContain('Autre');
  });
});
