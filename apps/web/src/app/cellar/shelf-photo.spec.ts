import { SHELF_PHOTO_MAX_BYTES, shelfPhotoRejection } from './shelf-photo';

describe('shelfPhotoRejection', () => {
  it('accepts jpeg png webp and heic', () => {
    expect(shelfPhotoRejection({ name: 'a.jpg', type: 'image/jpeg', size: 120 })).toBeNull();
    expect(shelfPhotoRejection({ name: 'a.png', type: 'image/png', size: 120 })).toBeNull();
    expect(shelfPhotoRejection({ name: 'a.webp', type: 'image/webp', size: 120 })).toBeNull();
    expect(shelfPhotoRejection({ name: 'a.heic', type: 'image/heic', size: 120 })).toBeNull();
  });

  it('rejects other types and files over 10 Mo before any upload', () => {
    expect(shelfPhotoRejection({ name: 'a.gif', type: 'image/gif', size: 120 })).toContain('heic');
    expect(
      shelfPhotoRejection({ name: 'a.jpg', type: 'image/jpeg', size: SHELF_PHOTO_MAX_BYTES + 1 }),
    ).toContain('10 Mo');
  });
});
