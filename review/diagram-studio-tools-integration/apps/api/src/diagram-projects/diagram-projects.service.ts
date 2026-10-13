import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { UserRole } from '../users/user.entity';
import { AuthUser } from '../auth/auth.types';
import { requireDiagramEditor } from './diagram-access.policy';
import { DiagramCircuit, DiagramCircuitStatus } from './diagram-circuit.entity';
import { DiagramProject, DiagramProjectStatus } from './diagram-project.entity';
import { CreateDiagramProjectDto, DiagramCircuitInputDto, UpdateDiagramProjectDto } from './diagram-projects.dto';

import { validateImagePreparation, type ImagePreparation } from './image-preparation';

type DraftInput = { schema: Record<string, unknown>; warnings: string[]; uncertainItems: string[]; validationErrors: string[]; model: string; preparation?: ImagePreparation };
type SourceFile = { buffer: Buffer; mimetype: string; originalname: string; size: number };

@Injectable()
export class DiagramProjectsService {
  constructor(@InjectRepository(DiagramProject) private readonly projects: Repository<DiagramProject>, @InjectRepository(DiagramCircuit) private readonly circuits: Repository<DiagramCircuit>, private readonly dataSource: DataSource) {}
  private admin(actor: AuthUser) { requireDiagramEditor(actor); }
  private projectAdmin(actor: AuthUser) { if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được xóa project'); }
  private async lockedProject(manager: EntityManager, id: string) {
    const project = await manager.findOne(DiagramProject, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!project || project.status !== DiagramProjectStatus.ACTIVE) throw new NotFoundException('Project không tồn tại hoặc đã xóa');
    return project;
  }
  async list() { const rows = await this.projects.find({ where: { status: DiagramProjectStatus.ACTIVE }, relations: { circuits: true }, order: { updatedAt: 'DESC' } }); return rows.map(row => this.summary(row)); }
  async detail(id: string) { const row = await this.projects.findOne({ where: { id, status: DiagramProjectStatus.ACTIVE }, relations: { circuits: true }, order: { circuits: { position: 'ASC' } } }); if (!row || row.status !== DiagramProjectStatus.ACTIVE) throw new NotFoundException('Diagram project not found'); return { ...row, completeness: this.completeness(row.circuits) }; }
  async create(dto: CreateDiagramProjectDto, actor: AuthUser) {
    const keys = dto.circuits.map(item => item.circuitKey); if (new Set(keys).size !== keys.length) throw new BadRequestException('Circuit key bị trùng trong project');
    if (await this.projects.exist({ where: { vehicleId: dto.vehicleId } })) throw new ConflictException('Vehicle ID đã tồn tại');
    const project = await this.dataSource.transaction(async manager => { const saved = await manager.save(manager.create(DiagramProject, { vehicleId: dto.vehicleId, vehicleTitle: dto.vehicleTitle.trim(), manufacturer: dto.manufacturer?.trim() || null, modelYear: dto.modelYear?.trim() || null, ecmId: dto.ecmId?.trim() || null, scuId: dto.scuId?.trim() || null, createdById: actor.id, updatedById: actor.id })); await manager.save(dto.circuits.map((item, index) => manager.create(DiagramCircuit, { projectId: saved.id, circuitKey: item.circuitKey, circuitTitle: item.circuitTitle.trim(), required: item.required ?? true, position: index, status: DiagramCircuitStatus.REGISTERED }))); return saved; });
    return this.detail(project.id);
  }
  async update(id: string, dto: UpdateDiagramProjectDto, actor: AuthUser) {
    this.admin(actor);
    if (!dto.vehicleTitle.trim() || dto.circuits.some(circuit => !circuit.circuitTitle.trim())) throw new BadRequestException('Tên project và tên sơ đồ không được trống');
    const keys = dto.circuits.map(circuit => circuit.circuitKey), ids = dto.circuits.flatMap(circuit => circuit.id ? [circuit.id] : []);
    if (new Set(keys).size !== keys.length || new Set(ids).size !== ids.length) throw new BadRequestException('Circuit bị trùng trong project');
    try {
      await this.dataSource.transaction(async manager => {
        const project = await this.lockedProject(manager, id);
        const duplicate = await manager.findOneBy(DiagramProject, { vehicleId: dto.vehicleId });
        if (duplicate && duplicate.id !== id) throw new ConflictException('Vehicle ID đã tồn tại');
        const circuits = await manager.find(DiagramCircuit, { where: { projectId: id } });
        if (ids.some(circuitId => !circuits.some(circuit => circuit.id === circuitId))) throw new BadRequestException('Circuit không thuộc project');
        const removed = circuits.filter(circuit => !ids.includes(circuit.id));
        if (removed.some(circuit => circuit.schema || circuit.sourceFileName || circuit.sourceByteSize || circuit.aiReview || circuit.validationErrors || circuit.generatedByModel || circuit.status !== DiagramCircuitStatus.REGISTERED)) throw new BadRequestException('Sơ đồ đã có dữ liệu không được bỏ. Hãy chuyển sang không bắt buộc.');
        for (const circuit of removed) await manager.delete(DiagramCircuit, { id: circuit.id });
        // Release old keys first so swapping two slot keys stays within the unique constraint.
        for (const circuit of circuits.filter(circuit => ids.includes(circuit.id))) {
          if (dto.circuits.find(item => item.id === circuit.id)!.circuitKey !== circuit.circuitKey) await manager.update(DiagramCircuit, circuit.id, { circuitKey: `edit-${randomUUID()}` });
        }
        Object.assign(project, { vehicleId: dto.vehicleId, vehicleTitle: dto.vehicleTitle.trim(), manufacturer: dto.manufacturer.trim() || null, modelYear: dto.modelYear.trim() || null, ecmId: dto.ecmId.trim() || null, scuId: dto.scuId.trim() || null, updatedById: actor.id });
        await manager.save(project);
        for (const [position, input] of dto.circuits.entries()) {
          const circuit = input.id ? circuits.find(circuit => circuit.id === input.id)! : manager.create(DiagramCircuit, { projectId: id, status: DiagramCircuitStatus.REGISTERED });
          Object.assign(circuit, { circuitKey: input.circuitKey, circuitTitle: input.circuitTitle.trim(), required: input.required ?? true, position, updatedById: actor.id });
          if (circuit.schema) circuit.schema = { ...circuit.schema, id: `${project.vehicleId}-${circuit.circuitKey}`, vehicleId: project.vehicleId, vehicleTitle: project.vehicleTitle, circuitTitle: circuit.circuitTitle };
          await manager.save(circuit);
        }
      });
    } catch (error) { if ((error as { code?: string }).code === '23505') throw new ConflictException('Vehicle ID hoặc Circuit key đã tồn tại'); throw error; }
    return this.detail(id);
  }
  async archive(id: string, confirmationTitle: string, actor: AuthUser) {
    this.projectAdmin(actor);
    await this.dataSource.transaction(async manager => {
      const project = await this.lockedProject(manager, id);
      if (confirmationTitle !== project.vehicleTitle) throw new BadRequestException('Nhập đúng tên project để xác nhận xóa');
      project.status = DiagramProjectStatus.ARCHIVED; project.updatedById = actor.id; await manager.save(project);
    });
    return { id, status: DiagramProjectStatus.ARCHIVED };
  }
  async addCircuit(projectId: string, dto: DiagramCircuitInputDto, actor: AuthUser) {
    this.admin(actor);
    await this.dataSource.transaction(async manager => {
      await this.lockedProject(manager, projectId);
      if (await manager.existsBy(DiagramCircuit, { projectId, circuitKey: dto.circuitKey })) throw new ConflictException('Circuit đã đăng ký');
      const position = await manager.countBy(DiagramCircuit, { projectId });
      await manager.save(manager.create(DiagramCircuit, { projectId, circuitKey: dto.circuitKey, circuitTitle: dto.circuitTitle.trim(), required: dto.required ?? true, position, status: DiagramCircuitStatus.REGISTERED, updatedById: actor.id }));
    });
    return this.detail(projectId);
  }
  private async writeCircuit(id: string, action: (circuit: DiagramCircuit, project: DiagramProject, manager: EntityManager) => Promise<void>) {
    const initial = await this.circuits.findOneBy({ id }); if (!initial) throw new NotFoundException('Diagram circuit not found');
    await this.dataSource.transaction(async manager => {
      const project = await this.lockedProject(manager, initial.projectId);
      const circuit = await manager.findOne(DiagramCircuit, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!circuit) throw new NotFoundException('Diagram circuit not found');
      await action(circuit, project, manager);
    });
    return this.detail(initial.projectId);
  }
  async saveDraft(circuitId: string, input: DraftInput, file: SourceFile, actor: AuthUser) {
    this.admin(actor); if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) || file.size < 1 || file.size > 12 * 1024 * 1024) throw new BadRequestException('Ảnh nguồn không hợp lệ');
    const preparation = await validateImagePreparation(input.preparation, file.buffer);
    return this.writeCircuit(circuitId, async (circuit, project, manager) => {
    const schemaVehicleId = String(input.schema.vehicleId || ''); const schemaCircuitTitle = String(input.schema.circuitTitle || '');
    if (schemaVehicleId !== project.vehicleId || schemaCircuitTitle !== circuit.circuitTitle) throw new BadRequestException('Schema identity không khớp circuit slot');
    input.schema = { ...input.schema, id: `${project.vehicleId}-${circuit.circuitKey}`, vehicleTitle: project.vehicleTitle, reviewStatus: 'draft' };
    circuit.sourceFileName = file.originalname; circuit.sourceMimeType = file.mimetype; circuit.sourceByteSize = file.size; circuit.sourceImage = file.buffer; circuit.schema = input.schema; circuit.aiReview = { warnings: input.warnings, uncertainItems: input.uncertainItems, ...(preparation ? { preparation } : {}) }; circuit.validationErrors = input.validationErrors; circuit.generatedByModel = input.model; circuit.updatedById = actor.id; circuit.status = this.deriveStatus(circuit); await manager.save(circuit);
    });
  }
  async source(circuitId: string) { const row = await this.circuits.createQueryBuilder('c').addSelect('c.sourceImage').where('c.id = :id', { id: circuitId }).getOne(); if (!row?.sourceImage || !row.sourceMimeType) throw new NotFoundException('Circuit source image not found'); await this.detail(row.projectId); return row; }
  async updateStatus(circuitId: string, status: DiagramCircuitStatus, actor: AuthUser) { this.admin(actor); if (![DiagramCircuitStatus.LAYOUT_REVIEWED, DiagramCircuitStatus.ELECTRICALLY_REVIEWED, DiagramCircuitStatus.NEEDS_REVIEW].includes(status)) throw new BadRequestException('Status này do hệ thống tự tính'); return this.writeCircuit(circuitId, async (row, _project, manager) => { if (!row.schema || !row.sourceFileName) throw new BadRequestException('Circuit chưa đủ output để review'); row.status = status; row.updatedById = actor.id; await manager.save(row); }); }
  private deriveStatus(row: DiagramCircuit) { if (!row.sourceImage || !row.schema || !row.aiReview) return DiagramCircuitStatus.MISSING_OUTPUT; const components = Array.isArray((row.schema as any).components) ? (row.schema as any).components.length : 0; const wires = Array.isArray((row.schema as any).wires) ? (row.schema as any).wires.length : 0; if (!components || !wires) return DiagramCircuitStatus.MISSING_OUTPUT; return row.validationErrors?.length || row.aiReview.warnings.length || row.aiReview.uncertainItems.length ? DiagramCircuitStatus.NEEDS_REVIEW : DiagramCircuitStatus.DRAFT_READY; }
  private completeness(circuits: DiagramCircuit[]) { const required = circuits.filter(item => item.required); const outputCount = required.filter(item => item.sourceFileName && item.schema && item.aiReview).length; return { outputCount, requiredCount: required.length, missingCount: required.length - outputCount, complete: required.length > 0 && outputCount === required.length }; }
  private summary(row: DiagramProject) { return { ...row, completeness: this.completeness(row.circuits || []) }; }
}
