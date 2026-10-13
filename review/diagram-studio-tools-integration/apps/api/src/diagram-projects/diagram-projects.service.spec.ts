import { DiagramCircuitStatus } from './diagram-circuit.entity';
import { DiagramProject } from './diagram-project.entity';
import { DiagramProjectsService } from './diagram-projects.service';
import { UserRole } from '../users/user.entity';

const actor = { id: 'admin', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
const project = { id: 'project', vehicleId: 'honda-vision-k2c-smartkey', vehicleTitle: 'Honda Vision K2C Smartkey', status: 'ACTIVE', circuits: [] } as any;
const writes = (row: any, save = jest.fn()) => ({ transaction: jest.fn(fn => fn({ findOne: jest.fn(async entity => entity === DiagramProject ? project : row), save })) });

describe('DiagramProjectsService', () => {
  it('reports required circuits missing until draft output is ready', async () => {
    const projects = { find: jest.fn().mockResolvedValue([{ ...project, circuits: [{ required: true, status: DiagramCircuitStatus.REGISTERED }, { required: true, status: DiagramCircuitStatus.NEEDS_REVIEW, sourceFileName: 'source.jpg', schema: {}, aiReview: { warnings: ['review'], uncertainItems: [] } }, { required: false, status: DiagramCircuitStatus.REGISTERED }] }]) } as any;
    const service = new DiagramProjectsService(projects, {} as any, {} as any);
    const [result] = await service.list();
    expect(result.completeness).toEqual({ outputCount: 1, requiredCount: 2, missingCount: 1, complete: false });
  });

  it('rejects duplicate registered circuit keys at project creation', async () => {
    const service = new DiagramProjectsService({ exist: jest.fn().mockResolvedValue(false) } as any, {} as any, {} as any);
    await expect(service.create({ vehicleId: 'bike', vehicleTitle: 'Bike', circuits: [{ circuitKey: 'starting', circuitTitle: 'Start' }, { circuitKey: 'starting', circuitTitle: 'Start 2' }] }, actor)).rejects.toThrow('Circuit key bị trùng');
  });

  it('rejects a draft whose vehicle or circuit identity does not match its slot', async () => {
    const circuits = { findOneBy: jest.fn().mockResolvedValue({ id: 'circuit', projectId: 'project', circuitTitle: 'Mạch khởi động' }) } as any;
    const projects = { findOneBy: jest.fn().mockResolvedValue(project) } as any;
    const service = new DiagramProjectsService(projects, circuits, writes({ id: 'circuit', projectId: 'project', circuitTitle: 'Mạch khởi động' }) as any);
    await expect(service.saveDraft('circuit', { schema: { vehicleId: 'wrong', circuitTitle: 'Mạch khởi động' }, warnings: [], uncertainItems: [], validationErrors: [], model: 'test' }, { buffer: Buffer.from([1]), mimetype: 'image/png', originalname: 'source.png', size: 1 }, actor)).rejects.toThrow('Schema identity không khớp');
  });
  it.each([actor, { ...actor, id: 'dev', username: 'phu', role: UserRole.MEMBER }])('persists manual drafts with diagnostics for $username and requires review again', async editor => {
    const row = { id: 'circuit', projectId: 'project', circuitKey: 'starting', circuitTitle: 'Mạch khởi động', status: DiagramCircuitStatus.ELECTRICALLY_REVIEWED };
    const circuits = { findOneBy: jest.fn().mockResolvedValue(row), save: jest.fn() };
    const projects = { findOneBy: jest.fn().mockResolvedValue(project), findOne: jest.fn().mockResolvedValue({ ...project, circuits: [row] }) };
    const service = new DiagramProjectsService(projects as any, circuits as any, writes(row, circuits.save) as any);
    const schema = { vehicleId: project.vehicleId, circuitTitle: row.circuitTitle, reviewStatus: 'electrically-reviewed', components: [{ label: 'Edited' }], wires: [{ id: 'w1' }] };
    const source = { buffer: Buffer.from([1]), mimetype: 'image/png', originalname: 'source.png', size: 1 };
    await service.saveDraft('circuit', { schema, warnings: ['AI original warning'], uncertainItems: ['Check pin'], validationErrors: ['Trace clearance below 16'], model: 'gpt-5.5' }, source, editor);
    expect(circuits.save).toHaveBeenCalledWith(expect.objectContaining({ schema: { ...schema, id: `${project.vehicleId}-starting`, vehicleTitle: project.vehicleTitle, reviewStatus: 'draft' }, sourceImage: source.buffer, sourceFileName: 'source.png', generatedByModel: 'gpt-5.5', validationErrors: ['Trace clearance below 16'], status: DiagramCircuitStatus.NEEDS_REVIEW, updatedById: editor.id }));
    expect(schema.reviewStatus).toBe('electrically-reviewed');
  });
  it('does not grant manual draft editing to members', async () => {
    const circuits = { save: jest.fn() };
    const service = new DiagramProjectsService({} as any, circuits as any, {} as any);
    await expect(service.saveDraft('circuit', { schema: {}, warnings: [], uncertainItems: [], validationErrors: [], model: 'test' }, { buffer: Buffer.from([1]), mimetype: 'image/png', originalname: 'source.png', size: 1 }, { ...actor, role: UserRole.MEMBER })).rejects.toThrow('Chỉ Admin');
    expect(circuits.save).not.toHaveBeenCalled();
  });
});


describe('Diagram project creation permissions', () => {
  it.each(['thang', 'phu'])('preserves Dev %s review access', async username => {
    const editor = { ...actor, id: 'dev', username, role: UserRole.MEMBER };
    const row = { id: 'circuit', projectId: project.id, schema: {}, sourceFileName: 'source.png' };
    const circuits = { exist: jest.fn().mockResolvedValue(false), count: jest.fn().mockResolvedValue(0), create: jest.fn(data => data), save: jest.fn(), findOneBy: jest.fn().mockResolvedValue(row) };
    const service = new DiagramProjectsService({ findOne: jest.fn().mockResolvedValue(project) } as any, circuits as any, writes(row, circuits.save) as any);
    await service.updateStatus(row.id, DiagramCircuitStatus.ELECTRICALLY_REVIEWED, editor);
    expect(circuits.save).toHaveBeenLastCalledWith(expect.objectContaining({ updatedById: editor.id, status: DiagramCircuitStatus.ELECTRICALLY_REVIEWED }));
  });
  it.each([UserRole.MEMBER, UserRole.ADMIN])('allows %s to create a vehicle and records its author', async role => {
    const creator = { ...actor, id: 'creator', role };
    const manager = {
      create: jest.fn((_entity, data) => data),
      save: jest.fn().mockResolvedValueOnce({ id: 'project' }).mockResolvedValueOnce([]),
    };
    const projects = { exist: jest.fn().mockResolvedValue(false), findOne: jest.fn().mockResolvedValue(project) };
    const dataSource = { transaction: jest.fn(fn => fn(manager)) };
    const service = new DiagramProjectsService(projects as any, {} as any, dataSource as any);
    const result = await service.create({ vehicleId: 'bike', vehicleTitle: ' Bike ', circuits: [{ circuitKey: 'horn', circuitTitle: 'Horn' }] }, creator);
    expect(result.id).toBe('project');
    expect(manager.create.mock.calls[0][1]).toMatchObject({ vehicleId: 'bike', vehicleTitle: 'Bike', createdById: 'creator', updatedById: 'creator' });
    expect(manager.create.mock.calls[1][1]).toMatchObject({ projectId: 'project', circuitKey: 'horn', status: DiagramCircuitStatus.REGISTERED });
    expect(manager.save).toHaveBeenCalledTimes(2);
  });

  it('still rejects a duplicate vehicle for a member', async () => {
    const transaction = jest.fn();
    const service = new DiagramProjectsService({ exist: jest.fn().mockResolvedValue(true) } as any, {} as any, { transaction } as any);
    await expect(service.create({ vehicleId: 'bike', vehicleTitle: 'Bike', circuits: [{ circuitKey: 'horn', circuitTitle: 'Horn' }] }, { ...actor, role: UserRole.MEMBER })).rejects.toThrow('Vehicle ID đã tồn tại');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('still denies review approval to a member', async () => {
    const save = jest.fn();
    const service = new DiagramProjectsService({} as any, { save } as any, {} as any);
    await expect(service.updateStatus('circuit', DiagramCircuitStatus.ELECTRICALLY_REVIEWED, { ...actor, role: UserRole.MEMBER })).rejects.toThrow('Chỉ Admin');
    expect(save).not.toHaveBeenCalled();
  });
});
