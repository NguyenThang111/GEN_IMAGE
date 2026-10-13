import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { EmailEventType, EmailOutbox } from './email-outbox.entity';

export type QueueEmail = {
  recipient: User;
  recipientEmail?: string;
  eventType: EmailEventType;
  dedupeKey: string;
  subject: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: nodemailer.Transporter | null;
  private timer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(@InjectRepository(EmailOutbox) private readonly outbox: Repository<EmailOutbox>) {
    const host = process.env.SMTP_HOST;
    const from = process.env.MAIL_FROM;
    this.transport = host && from ? nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
    }) : null;
  }

  async queue(manager: EntityManager, messages: QueueEmail[]) {
    if (!messages.length) return;
    for (const message of messages) {
      const recipientEmail = message.recipientEmail ?? message.recipient.email;
      await manager.query(
        'INSERT INTO email_outbox ("recipientUserId", "recipientEmail", "eventType", "dedupeKey", subject, payload, status, "attemptCount", "lastError", "availableAt") VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,0,$8,now()) ON CONFLICT ("dedupeKey") DO NOTHING',
        [message.recipient.id, recipientEmail, message.eventType, message.dedupeKey, message.subject, JSON.stringify(message.payload), recipientEmail ? 'PENDING' : 'SKIPPED', recipientEmail ? null : 'Recipient email is not configured'],
      );
    }
  }

  async onModuleInit() {
    await this.outbox.createQueryBuilder().update().set({ status: 'FAILED', lastError: 'Worker restarted before send completed', availableAt: new Date() }).where("status = 'PROCESSING'").execute();
    if (!this.transport) {
      this.logger.warn('SMTP is not configured; email remains queued without affecting Workplace');
      return;
    }
    this.timer = setInterval(() => void this.processPending(), 15_000);
    this.timer.unref();
    void this.processPending();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processPending() {
    if (!this.transport || this.processing) return;
    this.processing = true;
    try {
      const rows = await this.outbox.createQueryBuilder('mail')
        .where("mail.status IN ('PENDING', 'FAILED')")
        .andWhere('mail.attemptCount < 3')
        .andWhere('(mail.availableAt IS NULL OR mail.availableAt <= :now)', { now: new Date() })
        .orderBy('mail.createdAt', 'ASC')
        .take(20)
        .getMany();
      for (const mail of rows) await this.send(mail);
    } finally {
      this.processing = false;
    }
  }

  private async send(mail: EmailOutbox) {
    const claimed = await this.outbox.createQueryBuilder().update().set({ status: 'PROCESSING' }).where('id = :id', { id: mail.id }).andWhere("status IN ('PENDING', 'FAILED')").execute();
    if (!claimed.affected || !mail.recipientEmail || !this.transport) return;
    try {
      await this.transport.sendMail({
        from: process.env.MAIL_FROM,
        to: mail.recipientEmail,
        subject: mail.subject,
        text: this.renderText(mail.payload),
      });
      await this.outbox.update(mail.id, { status: 'SENT', attemptCount: mail.attemptCount + 1, lastError: null, sentAt: new Date() });
    } catch (error) {
      const attemptCount = mail.attemptCount + 1;
      const message = error instanceof Error ? error.message : 'SMTP send failed';
      await this.outbox.update(mail.id, { status: 'FAILED', attemptCount, lastError: message.slice(0, 500), availableAt: new Date(Date.now() + attemptCount * 60_000) });
      this.logger.warn(`Email ${mail.id} failed on attempt ${attemptCount}`);
    }
  }

  private renderText(payload: Record<string, unknown>) {
    return [
      payload.actorName ? `Người thực hiện: ${payload.actorName}` : null,
      payload.topic ? `Task: ${payload.topic}` : null,
      payload.dueDate ? `Due Date: ${payload.dueDate}` : null,
      payload.bodyPreview ? `Nội dung: ${payload.bodyPreview}` : null,
      payload.itemName ? `Vật tư: ${payload.itemName}` : null,
      payload.requestedQty ? `Số lượng yêu cầu: ${payload.requestedQty} unit` : null,
      payload.onHandQty !== undefined ? `Tồn hiện tại: ${payload.onHandQty ?? 'chưa kiểm'} unit` : null,
      payload.minimumStock !== undefined ? `Mức dự trữ: ${payload.minimumStock} unit` : null,
      '',
      `Mở Auto2Tech OS: ${payload.appUrl ?? process.env.APP_PUBLIC_URL ?? 'https://auto2tech-app-production.up.railway.app'}`,
    ].filter((line) => line !== null).join('\n');
  }
}
