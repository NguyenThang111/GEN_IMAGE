import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
const sharp = require('sharp') as (input: Buffer, options?: { limitInputPixels: number }) => import('sharp').Sharp;

export type ImagePreparation = {
  version: 1;
  source: { name: string; sha256: string; width: number; height: number; coordinates: string };
  crop: { x: number; y: number; width: number; height: number };
  canvas: { width: number; height: number };
  scale: { x: number; y: number };
  adjustments: { brightness: number; contrast: number };
  cleanSha256: string;
  rotation?: 0 | 90 | 180 | 270;
};

export async function validateImagePreparation(value: unknown, source: Buffer): Promise<ImagePreparation | undefined> {
  if (value === undefined) return undefined; // Existing circuits have no preparation metadata.
  try {
    const p = value as ImagePreparation;
    const { crop: c, canvas, scale, adjustments: a } = p;
    const rotation = p.rotation === undefined ? 0 : p.rotation;
    const sideways = rotation === 90 || rotation === 270;
    const cropWidth = sideways ? c.height : c.width, cropHeight = sideways ? c.width : c.height;
    const integers = [p.source.width, p.source.height, c.x, c.y, c.width, c.height, canvas.width, canvas.height];
    if (p.version !== 1 || ![0, 90, 180, 270].includes(rotation) || !integers.every(Number.isInteger) ||
      p.source.width < 1 || p.source.height < 1 || p.source.width * p.source.height > 24_000_000 ||
      c.x < 0 || c.y < 0 || c.width < 1 || c.height < 1 || c.x + c.width > p.source.width || c.y + c.height > p.source.height ||
      canvas.width < 1 || canvas.height < 1 || Math.max(canvas.width, canvas.height) > 2400 || canvas.width > cropWidth || canvas.height > cropHeight ||
      scale.x !== canvas.width / cropWidth || scale.y !== canvas.height / cropHeight ||
      ![a.brightness, a.contrast].every(n => Number.isFinite(n) && n >= 80 && n <= 120) ||
      typeof p.source.name !== 'string' || p.source.name.length > 255 || typeof p.source.coordinates !== 'string' || p.source.coordinates.length > 300 ||
      !/^[a-f0-9]{64}$/.test(p.cleanSha256) || p.source.sha256 !== createHash('sha256').update(source).digest('hex')) throw new Error();
    const meta = await sharp(source, { limitInputPixels: 24_000_000 }).metadata();
    const rotated = (meta.orientation ?? 1) >= 5;
    if (p.source.width !== (rotated ? meta.height : meta.width) || p.source.height !== (rotated ? meta.width : meta.height)) throw new Error();
    // Return only supported fields, not arbitrary client JSON.
    return { version: 1, source: { name: p.source.name, sha256: p.source.sha256, width: p.source.width, height: p.source.height, coordinates: p.source.coordinates },
      crop: { x: c.x, y: c.y, width: c.width, height: c.height }, canvas: { width: canvas.width, height: canvas.height },
      scale: { x: scale.x, y: scale.y }, adjustments: { brightness: a.brightness, contrast: a.contrast }, cleanSha256: p.cleanSha256, ...(p.rotation === undefined ? {} : { rotation }) };
  } catch { throw new BadRequestException('Thông số chuẩn bị ảnh không hợp lệ hoặc không khớp ảnh gốc.'); }
}
