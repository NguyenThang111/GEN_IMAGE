import { EntityManager, Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { EmailOutbox } from './email-outbox.entity';
import { EmailService } from './email.service';

function user(id: string, email: string | null) {
  return { id, username: id, displayName: id.toUpperCase(), email, role: UserRole.MEMBER, isActive: true, createdAt: new Date() } as User;
}

describe('EmailService queue', () => {
  const originalHost = process.env.SMTP_HOST;
  const originalFrom = process.env.MAIL_FROM;

  beforeEach(() => { delete process.env.SMTP_HOST; delete process.env.MAIL_FROM; });
  afterAll(() => {
    if (originalHost) process.env.SMTP_HOST = originalHost;
    if (originalFrom) process.env.MAIL_FROM = originalFrom;
  });

  it('queues configured recipient without sending inside the request', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    const service = new EmailService({} as Repository<EmailOutbox>);
    await service.queue({ query } as unknown as EntityManager, [{ recipient: user('phu', 'phu@example.com'), eventType: 'TASK_CLAIMED', dedupeKey: 'claim:1:phu', subject: 'Task', payload: { topic: 'KEYSCAN' } }]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT ("dedupeKey") DO NOTHING');
    expect(query.mock.calls[0][1][6]).toBe('PENDING');
  });

  it('records SKIPPED when recipient has no email', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    const service = new EmailService({} as Repository<EmailOutbox>);
    await service.queue({ query } as unknown as EntityManager, [{ recipient: user('vinh', null), eventType: 'TASK_COMMENTED', dedupeKey: 'comment:1:vinh', subject: 'Comment', payload: {} }]);
    expect(query.mock.calls[0][1][6]).toBe('SKIPPED');
    expect(query.mock.calls[0][1][7]).toBe('Recipient email is not configured');
  });

  it('uses the purchasing Admin recipient override', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    const service = new EmailService({} as Repository<EmailOutbox>);
    await service.queue({ query } as unknown as EntityManager, [{ recipient: user('admin', null), recipientEmail: 'easyscan.marketplace@gmail.com', eventType: 'PURCHASE_REQUEST_CREATED', dedupeKey: 'purchase-request:1:created', subject: 'Request mua', payload: { itemName: 'Trở 330R' } }]);
    expect(query.mock.calls[0][1][1]).toBe('easyscan.marketplace@gmail.com');
    expect(query.mock.calls[0][1][6]).toBe('PENDING');
  });
});
