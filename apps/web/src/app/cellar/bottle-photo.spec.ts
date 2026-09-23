import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../environments/environment';
import { BottlePhoto } from './bottle-photo';

describe('BottlePhoto', () => {
  let fixture: ComponentFixture<BottlePhoto>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottlePhoto],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BottlePhoto);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders a remote catalog url directly', () => {
    fixture.componentRef.setInput('src', 'https://example.com/lag.jpg');
    fixture.componentRef.setInput('alt', 'Lagavulin');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/lag.jpg');
    httpMock.expectNone(() => true);
  });

  it('loads a shelf override with the bearer client', () => {
    fixture.componentRef.setInput('src', '/api/v1/collection/bottles/4/photo');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();

    const req = httpMock.expectOne(
      `${environment.apiBaseUrl}/api/v1/collection/bottles/4/photo`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }));
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.src.startsWith('blob:')).toBeTrue();
  });
});
