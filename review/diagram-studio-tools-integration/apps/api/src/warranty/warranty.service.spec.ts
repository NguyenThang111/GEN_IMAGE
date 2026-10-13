import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/user.entity';
import { WarrantyCase, WarrantyStatus } from './warranty-case.entity';
import { WarrantyService } from './warranty.service';

describe('WarrantyService MVP rules', () => {
  const cases = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };
  const users = { findOneBy: jest.fn(async ({ id }) => ({ id, isActive: true })) };
  const realtime = { emitTask: jest.fn() };
  const service = new WarrantyService(cases as never, users as never, realtime as never);
  const admin = { id: 'admin-id', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
  const member = { id: 'member-id', username: 'thang', displayName: 'THẮNG', role: UserRole.MEMBER };

  beforeEach(() => jest.clearAllMocks());

  it('creates a simple received case and assigns a Member to themselves', async () => {
    cases.findOne.mockImplementation(async ({ where }) => ({
      id: where.id,
      code: 'BH-260818-ABC123',
      customerReference: 'Đơn 101',
      productName: 'Máy đọc lỗi EasyScan',
      receivedItems: '1 máy, 4 cáp',
      issue: 'Không lên nguồn',
      repairResult: null,
      status: WarrantyStatus.RECEIVED,
      isChargeable: true,
      assigneeId: member.id,
    }));
    const saved = await service.create({
      customerReference: ' Đơn 101 ',
      shippingCarrier: ' Viettel Post ',
      productName: ' Máy đọc lỗi EasyScan ',
      receivedItems: ' 1 máy, 4 cáp ',
      issue: ' Không lên nguồn ',
      isChargeable: true,
      assigneeId: 'another-id',
    }, member);
    expect(cases.create).toHaveBeenCalledWith(expect.objectContaining({
      code: expect.stringMatching(/^BH-\d{6}-[A-F0-9]{6}$/),
      customerReference: 'Đơn 101',
      shippingCarrier: 'Viettel Post',
      status: WarrantyStatus.RECEIVED,
      isChargeable: true,
      assigneeId: member.id,
      repairedAt: null,
      testedAt: null,
      returnedAt: null,
    }));
    expect(saved).toMatchObject({ status: WarrantyStatus.RECEIVED, isChargeable: true });
    expect(realtime.emitTask).toHaveBeenCalledWith('warranty.updated', saved);
  });

  it('sets all milestone timestamps when Admin moves a case to returned', async () => {
    const row = {
      id: 'case-id', status: WarrantyStatus.RECEIVED, assigneeId: member.id,
      repairedAt: null, testedAt: null, returnedAt: null,
    } as WarrantyCase;
    cases.findOneBy.mockResolvedValue(row);
    cases.findOne.mockResolvedValue(row);
    const saved = await service.update('case-id', { status: WarrantyStatus.RETURNED }, admin);
    expect(saved.status).toBe(WarrantyStatus.RETURNED);
    expect(saved.repairedAt).toBeInstanceOf(Date);
    expect(saved.testedAt).toBeInstanceOf(Date);
    expect(saved.returnedAt).toBeInstanceOf(Date);
  });

  it('does not let a Member reassign an existing case', async () => {
    cases.findOneBy.mockResolvedValue({ id: 'case-id', assigneeId: member.id, status: WarrantyStatus.RECEIVED });
    await expect(service.update('case-id', { assigneeId: 'another-id' }, member)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
