import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { User, UserRole } from '../users/user.entity';
import { WarrantyCase, WarrantyStatus } from './warranty-case.entity';
import { CreateWarrantyCaseDto, UpdateWarrantyCaseDto } from './warranty.dto';

const STATUS_RANK: Record<WarrantyStatus, number> = {
  [WarrantyStatus.RECEIVED]: 0,
  [WarrantyStatus.REPAIRED]: 1,
  [WarrantyStatus.TESTED]: 2,
  [WarrantyStatus.RETURNED]: 3,
};

@Injectable()
export class WarrantyService {
  constructor(
    @InjectRepository(WarrantyCase) private readonly cases: Repository<WarrantyCase>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly realtime: RealtimeGateway,
  ) {}

  list() {
    return this.cases.find({
      relations: { assignee: true, createdBy: true, updatedBy: true },
      order: { updatedAt: 'DESC' },
    });
  }

  async create(dto: CreateWarrantyCaseDto, actor: AuthUser) {
    const assigneeId = actor.role === UserRole.ADMIN ? dto.assigneeId || null : actor.id;
    await this.validateAssignee(assigneeId);
    const id = randomUUID();
    const status = dto.status ?? WarrantyStatus.RECEIVED;
    const row = this.cases.create({
      id,
      code: this.makeCode(id),
      customerReference: dto.customerReference.trim(),
      customerName: dto.customerName?.trim() || null,
      customerAddress: dto.customerAddress?.trim() || null,
      shippingCarrier: dto.shippingCarrier?.trim() || null,
      productName: dto.productName.trim(),
      receivedItems: dto.receivedItems.trim(),
      issue: dto.issue.trim(),
      repairResult: dto.repairResult?.trim() || null,
      status,
      isChargeable: dto.isChargeable ?? false,
      assigneeId,
      createdById: actor.id,
      updatedById: actor.id,
      repairedAt: null,
      testedAt: null,
      returnedAt: null,
    });
    this.applyMilestones(row, status);
    await this.cases.save(row);
    const saved = await this.requireView(id);
    this.realtime.emitTask('warranty.updated', saved);
    return saved;
  }

  async update(id: string, dto: UpdateWarrantyCaseDto, actor: AuthUser) {
    const row = await this.cases.findOneBy({ id });
    if (!row) throw new NotFoundException('Warranty case not found');
    if (dto.assigneeId !== undefined) {
      if (actor.role !== UserRole.ADMIN && dto.assigneeId !== row.assigneeId) throw new ForbiddenException('Only Admin can change assignee');
      await this.validateAssignee(dto.assigneeId);
    }
    if (dto.customerReference !== undefined) row.customerReference = dto.customerReference.trim();
    if (dto.customerName !== undefined) row.customerName = dto.customerName.trim() || null;
    if (dto.customerAddress !== undefined) row.customerAddress = dto.customerAddress.trim() || null;
    if (dto.shippingCarrier !== undefined) row.shippingCarrier = dto.shippingCarrier.trim() || null;
    if (dto.productName !== undefined) row.productName = dto.productName.trim();
    if (dto.receivedItems !== undefined) row.receivedItems = dto.receivedItems.trim();
    if (dto.issue !== undefined) row.issue = dto.issue.trim();
    if (dto.repairResult !== undefined) row.repairResult = dto.repairResult.trim() || null;
    if (dto.isChargeable !== undefined) row.isChargeable = dto.isChargeable;
    if (dto.assigneeId !== undefined) row.assigneeId = dto.assigneeId || null;
    if (dto.status !== undefined) {
      row.status = dto.status;
      this.applyMilestones(row, dto.status);
    }
    row.updatedById = actor.id;
    await this.cases.save(row);
    const saved = await this.requireView(id);
    this.realtime.emitTask('warranty.updated', saved);
    return saved;
  }

  private async validateAssignee(assigneeId: string | null | undefined) {
    if (!assigneeId) return;
    const user = await this.users.findOneBy({ id: assigneeId, isActive: true });
    if (!user) throw new BadRequestException('Assignee not found or inactive');
  }

  private async requireView(id: string) {
    const row = await this.cases.findOne({
      where: { id },
      relations: { assignee: true, createdBy: true, updatedBy: true },
    });
    if (!row) throw new NotFoundException('Warranty case not found');
    return row;
  }

  private applyMilestones(row: WarrantyCase, status: WarrantyStatus) {
    const now = new Date();
    const rank = STATUS_RANK[status];
    row.repairedAt = rank >= STATUS_RANK[WarrantyStatus.REPAIRED] ? row.repairedAt ?? now : null;
    row.testedAt = rank >= STATUS_RANK[WarrantyStatus.TESTED] ? row.testedAt ?? now : null;
    row.returnedAt = rank >= STATUS_RANK[WarrantyStatus.RETURNED] ? row.returnedAt ?? now : null;
  }

  private makeCode(id: string) {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: '2-digit', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
    const date = `${parts.year}${parts.month}${parts.day}`;
    return `BH-${date}-${id.slice(0, 6).toUpperCase()}`;
  }
}
