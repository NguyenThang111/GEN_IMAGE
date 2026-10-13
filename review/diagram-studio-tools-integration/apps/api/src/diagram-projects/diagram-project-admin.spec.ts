import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DiagramProjectsService } from './diagram-projects.service';
import { DiagramProject, DiagramProjectStatus } from './diagram-project.entity';
import { DiagramCircuit, DiagramCircuitStatus } from './diagram-circuit.entity';
import { UpdateDiagramProjectDto } from './diagram-projects.dto';
import { UserRole } from '../users/user.entity';

const admin = { id: 'admin', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
function setup() {
  const circuit = { id: '11111111-1111-4111-8111-111111111111', projectId: 'project', circuitKey: 'horn', circuitTitle: 'Còi', required: true, position: 0, status: DiagramCircuitStatus.ELECTRICALLY_REVIEWED, sourceFileName: 'source.png', sourceImage: Buffer.from('image'), schema: { id: 'old-horn', vehicleId: 'old', vehicleTitle: 'Old', circuitTitle: 'Còi', reviewStatus: 'electrically-reviewed', components: [{ id: 'c1' }], wires: [{ id: 'w1' }] }, aiReview: { warnings: [], uncertainItems: [] }, validationErrors: [] } as unknown as DiagramCircuit;
  const project = { id: 'project', vehicleId: 'old', vehicleTitle: 'Old', status: DiagramProjectStatus.ACTIVE, circuits: [circuit] } as DiagramProject;
  const manager = { findOne: jest.fn(async entity => entity === DiagramProject ? project : circuit), findOneBy: jest.fn().mockResolvedValue(null), find: jest.fn(async () => project.circuits), delete: jest.fn(), update: jest.fn(), save: jest.fn(async value => value), create: jest.fn((_entity, data) => data), existsBy: jest.fn().mockResolvedValue(false), countBy: jest.fn().mockResolvedValue(1) };
  const transaction = jest.fn(fn => fn(manager));
  const projects = { findOne: jest.fn(async () => project) };
  const circuits = { findOneBy: jest.fn(async () => circuit) };
  const service = new DiagramProjectsService(projects as any, circuits as any, { transaction } as any);
  const input: UpdateDiagramProjectDto = { vehicleId: 'new-bike', vehicleTitle: ' New Bike ', manufacturer: ' HONDA ', modelYear: '2026', ecmId: '', scuId: 'SCU', circuits: [{ id: circuit.id, circuitKey: 'horn-new', circuitTitle: ' Còi mới ', required: false }] };
  return { service, project, circuit, manager, transaction, input };
}
describe('Admin project management', () => {
  it.each(['my'])('denies metadata edits/archive/registry changes for %s before writes', async username => {
    const { service, input, transaction } = setup(); const member = { ...admin, username, role: UserRole.MEMBER };
    await expect(service.update('project', input, member)).rejects.toThrow('Chỉ Admin');
    await expect(service.archive('project', 'Old', member)).rejects.toThrow('Chỉ Admin');
    await expect(service.addCircuit('project', { circuitKey: 'new', circuitTitle: 'New' }, member)).rejects.toThrow('Chỉ Admin');
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each(['thang', 'phu'])('allows Dev %s to edit metadata and registry but never archive', async username => {
    const { service, input, project, manager } = setup();
    const dev = { ...admin, username, id: username, role: UserRole.MEMBER };
    await service.update(project.id, input, dev);
    expect(project.vehicleTitle).toBe('New Bike');
    expect(project.updatedById).toBe(username);
    await service.addCircuit(project.id, { circuitKey: 'new-slot', circuitTitle: 'New slot' }, dev);
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ circuitKey: 'new-slot', updatedById: username }));
    manager.save.mockClear();
    await expect(service.archive(project.id, project.vehicleTitle, dev)).rejects.toThrow('Chỉ Admin được xóa');
    expect(manager.save).not.toHaveBeenCalled();
    expect(project.status).toBe(DiagramProjectStatus.ACTIVE);
  });
  it('updates all metadata and JSON identity while preserving image/topology/review', async () => {
    const { service, input, project, circuit, manager } = setup(); const original = circuit.schema!, image = circuit.sourceImage;
    await service.update(project.id, input, admin);
    expect(project).toMatchObject({ vehicleId: 'new-bike', vehicleTitle: 'New Bike', manufacturer: 'HONDA', modelYear: '2026', ecmId: null, scuId: 'SCU', updatedById: 'admin' });
    expect(circuit.schema).toEqual({ ...original, id: 'new-bike-horn-new', vehicleId: 'new-bike', vehicleTitle: 'New Bike', circuitTitle: 'Còi mới' });
    expect(circuit.sourceImage).toBe(image); expect(circuit.status).toBe(DiagramCircuitStatus.ELECTRICALLY_REVIEWED);
    expect(circuit.required).toBe(false); expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(DiagramCircuit, circuit.id, { circuitKey: expect.stringMatching(/^edit-/) });
    expect(manager.findOne).toHaveBeenCalledWith(DiagramProject, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });
  it('rejects removing a circuit with data before any mutation', async () => {
    const { service, input, manager } = setup(); input.circuits = [{ circuitKey: 'other', circuitTitle: 'Other' }];
    await expect(service.update('project', input, admin)).rejects.toThrow('Sơ đồ đã có dữ liệu');
    expect(manager.delete).not.toHaveBeenCalled(); expect(manager.save).not.toHaveBeenCalled();
  });
  it('allows removing an empty slot and adding a new slot', async () => {
    const { service, input, project, manager } = setup();
    project.circuits = [{ id: 'empty', circuitKey: 'empty', status: DiagramCircuitStatus.REGISTERED } as DiagramCircuit];
    input.circuits = [{ circuitKey: 'new', circuitTitle: 'New', required: true }];
    await service.update('project', input, admin);
    expect(manager.delete).toHaveBeenCalledWith(DiagramCircuit, { id: 'empty' });
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ circuitKey: 'new', status: DiagramCircuitStatus.REGISTERED }));
  });
  it('blocks foreign slots, duplicated keys/IDs and blank titles', async () => {
    const { service, input, manager } = setup();
    await expect(service.update('project', { ...input, vehicleTitle: ' ' }, admin)).rejects.toThrow('không được trống');
    await expect(service.update('project', { ...input, circuits: [input.circuits[0], input.circuits[0]] }, admin)).rejects.toThrow('trùng');
    await expect(service.update('project', { ...input, circuits: [{ ...input.circuits[0], id: 'foreign' }] }, admin)).rejects.toThrow('không thuộc');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('handles duplicate Vehicle ID, including a database uniqueness race', async () => {
    const { service, input, manager, transaction } = setup(); manager.findOneBy.mockResolvedValue({ id: 'another' });
    await expect(service.update('project', input, admin)).rejects.toThrow('Vehicle ID đã tồn tại');
    expect(manager.save).not.toHaveBeenCalled();
    transaction.mockRejectedValueOnce({ code: '23505' });
    await expect(service.update('project', input, admin)).rejects.toThrow('đã tồn tại');
  });
  it('requires the exact current title to archive and never deletes circuit records', async () => {
    const { service, project, circuit, manager } = setup();
    await expect(service.archive('project', 'Wrong', admin)).rejects.toThrow('Nhập đúng tên');
    expect(manager.save).not.toHaveBeenCalled();
    await expect(service.archive('project', 'Old', admin)).resolves.toEqual({ id: 'project', status: 'ARCHIVED' });
    expect(project.status).toBe('ARCHIVED'); expect(project.circuits[0]).toBe(circuit);
    expect(manager.delete).not.toHaveBeenCalled(); expect(manager.save).toHaveBeenCalledTimes(1);
    await expect(service.detail('project')).rejects.toThrow('not found');
  });
  it('blocks writes on archived projects, including an old Dev editor tab', async () => {
    const { service, project, input, circuit, manager } = setup(); project.status = DiagramProjectStatus.ARCHIVED;
    await expect(service.update('project', input, admin)).rejects.toThrow('đã xóa');
    await expect(service.addCircuit('project', { circuitKey: 'x', circuitTitle: 'X' }, admin)).rejects.toThrow('đã xóa');
    await expect(service.saveDraft(circuit.id, { schema: circuit.schema!, warnings: [], uncertainItems: [], validationErrors: [], model: 'test' }, { buffer: Buffer.from('i'), mimetype: 'image/png', size: 1, originalname: 'i.png' }, { ...admin, role: UserRole.MEMBER, username: 'thang' })).rejects.toThrow('đã xóa');
    await expect(service.updateStatus(circuit.id, DiagramCircuitStatus.LAYOUT_REVIEWED, admin)).rejects.toThrow('đã xóa');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('supports empty optional values and rejects malformed identity in DTO validation', async () => {
    const { input } = setup(); expect(await validate(plainToInstance(UpdateDiagramProjectDto, input))).toEqual([]);
    expect((await validate(plainToInstance(UpdateDiagramProjectDto, { ...input, vehicleId: '../bad', circuits: [] }))).length).toBeGreaterThan(0);
  });
});
