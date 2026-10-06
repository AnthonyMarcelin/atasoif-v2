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

  it('opens an accessible lightbox on photo tap and closes on Escape', () => {
    fixture.componentRef.setInput('src', 'https://example.com/lag.jpg');
    fixture.componentRef.setInput('alt', 'Lagavulin');
    fixture.detectChanges();

    const hit = fixture.nativeElement.querySelector('.bottle-photo__hit') as HTMLButtonElement;
    expect(hit.getAttribute('aria-label')).toContain('Agrandir la photo');
    hit.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.bottle-lightbox') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bottle-lightbox')).toBeNull();
  });

  it('frames thumbnails with object-fit contain', () => {
    fixture.componentRef.setInput('src', 'https://example.com/lag.jpg');
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('.bottle-photo__img') as HTMLImageElement;
    expect(getComputedStyle(img).objectFit).toBe('contain');
  });
});
