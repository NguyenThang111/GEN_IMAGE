import { createHash } from 'node:crypto';
import { validateImagePreparation } from './image-preparation';
import { DiagramProjectsService } from './diagram-projects.service';
import { DiagramProject } from './diagram-project.entity';
import { UserRole } from '../users/user.entity';

const sharp = require('sharp');
describe('circuit image preparation metadata', () => {
  let source: Buffer;
  let value: any;
  beforeEach(async () => {
    source = await sharp({ create: { width: 800, height: 600, channels: 3, background: 'white' } }).png().toBuffer();
    value = { version: 1, source: { name: 'original.png', sha256: createHash('sha256').update(source).digest('hex'), width: 800, height: 600, coordinates: 'EXIF-oriented pixels' },
      crop: { x: 100, y: 50, width: 600, height: 400 }, canvas: { width: 300, height: 200 }, scale: { x: .5, y: .5 }, adjustments: { brightness: 100, contrast: 100 }, cleanSha256: 'a'.repeat(64) };
  });
  it('accepts legacy drafts with no metadata', async () => {
    expect(await validateImagePreparation(undefined, Buffer.from('legacy'))).toBeUndefined();
  });
  it('retains valid metadata without changing source bytes or arbitrary extra fields', async () => {
    const before = Buffer.from(source);
    expect(await validateImagePreparation({ ...value, unrelated: 'drop' }, source)).toEqual(value);
    expect(source.equals(before)).toBe(true);
  });
  it('persists original bytes and preparation with a draft; rejects mismatches before writing', async () => {
    const row = { id: 'c', projectId: 'p', circuitKey: 'lamp', circuitTitle: 'Lamp' };
    const project = { id: 'p', vehicleId: 'bike', vehicleTitle: 'Bike', status: 'ACTIVE', circuits: [row] };
    const save = jest.fn();
    const projects = { findOne: jest.fn().mockResolvedValue(project) };
    const dataSource = { transaction: jest.fn(fn => fn({ findOne: jest.fn(async entity => entity === DiagramProject ? project : row), save })) };
    const service = new DiagramProjectsService(projects as any, { findOneBy: jest.fn().mockResolvedValue(row) } as any, dataSource as any);
    const input = { schema: { vehicleId: 'bike', circuitTitle: 'Lamp' }, warnings: [], uncertainItems: [], validationErrors: [], model: 'mock', preparation: value };
    const file = { buffer: source, size: source.length, mimetype: 'image/png', originalname: 'original.png' };
    const actor = { id: 'admin', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
    await service.saveDraft('c', input, file, actor);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ sourceImage: source, aiReview: { warnings: [], uncertainItems: [], preparation: value } }));
    save.mockClear();
    await expect(service.saveDraft('c', { ...input, preparation: { ...value, source: { ...value.source, sha256: 'b'.repeat(64) } } }, file, actor)).rejects.toThrow('Thông số chuẩn bị ảnh');
    expect(save).not.toHaveBeenCalled();
  });
  it.each([0, 90, 180, 270])('retains rotation %i with the correct crop scale', async rotation => {
    const sideways = rotation === 90 || rotation === 270;
    const input = { ...value, rotation, canvas: sideways ? { width: 200, height: 300 } : value.canvas };
    expect(await validateImagePreparation(input, source)).toEqual(input);
    if (sideways) await expect(validateImagePreparation({ ...input, canvas: value.canvas }, source)).rejects.toThrow('Thông số chuẩn bị ảnh');
  });
  it.each([45, '90', null])('rejects unsupported rotation %s', async rotation => {
    await expect(validateImagePreparation({ ...value, rotation }, source)).rejects.toThrow('Thông số chuẩn bị ảnh');
  });
  it.each(['bounds', 'scale', 'hash', 'dimensions', 'brightness', 'oversize', 'null'])('rejects invalid %s', async kind => {
    if (kind === 'bounds') value.crop.x = 900;
    if (kind === 'scale') value.scale.x = 2;
    if (kind === 'hash') value.source.sha256 = 'b'.repeat(64);
    if (kind === 'dimensions') value.source.width = 900;
    if (kind === 'brightness') value.adjustments.brightness = 200;
    if (kind === 'oversize') value.canvas.width = 2500;
    if (kind === 'null') value = null;
    await expect(validateImagePreparation(value, source)).rejects.toThrow('Thông số chuẩn bị ảnh');
  });
});
