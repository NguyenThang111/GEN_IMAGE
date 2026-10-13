import { BadRequestException } from '@nestjs/common';
import { INVENTORY_IMAGE_MAX_BYTES, validateInventoryImage } from './inventory-image.policy';

describe('inventory image policy', () => {
  it.each([
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
  ])('accepts a valid %s header', (mimetype, buffer) => {
    expect(() => validateInventoryImage({ mimetype, buffer, size: buffer.length })).not.toThrow();
  });

  it('rejects spoofed image content', () => {
    const buffer = Buffer.from('not-an-image');
    expect(() => validateInventoryImage({ mimetype: 'image/png', buffer, size: buffer.length })).toThrow(BadRequestException);
  });

  it('rejects a processed file above 600KB', () => {
    const buffer = Buffer.alloc(INVENTORY_IMAGE_MAX_BYTES + 1);
    expect(() => validateInventoryImage({ mimetype: 'image/jpeg', buffer, size: buffer.length })).toThrow('Processed image must not exceed 600KB');
  });
});
