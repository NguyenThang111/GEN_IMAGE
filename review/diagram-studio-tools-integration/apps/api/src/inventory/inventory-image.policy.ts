import { BadRequestException } from '@nestjs/common';

export const INVENTORY_IMAGE_MAX_BYTES = 600 * 1024;
export const INVENTORY_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function validateInventoryImage(file: { buffer: Buffer; mimetype: string; size: number }) {
  if (!(INVENTORY_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    throw new BadRequestException('Only JPEG, PNG or WebP images are allowed');
  }
  if (file.size < 1 || file.size > INVENTORY_IMAGE_MAX_BYTES || file.buffer.length !== file.size) {
    throw new BadRequestException('Processed image must not exceed 600KB');
  }
  const jpeg = file.buffer.length >= 3 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  const png = file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = file.buffer.length >= 12 && file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' && file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const matches = file.mimetype === 'image/jpeg' ? jpeg : file.mimetype === 'image/png' ? png : webp;
  if (!matches) throw new BadRequestException('Image content does not match its file type');
}
