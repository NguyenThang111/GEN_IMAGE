import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createWorker, PSM } from 'tesseract.js';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { UserRole } from '../users/user.entity';
import { calculateActivationCode, extractSeriesCandidates } from './activation.calculator';
import { GenerateActivationDto } from './activation.dto';
import { ActivationCode } from './activation.entity';

const sharp = require('sharp') as (input: Buffer) => import('sharp').Sharp;

export const ACTIVATION_SOURCES = ['Trần Hoan', 'TAD', 'Khiêm chipp', 'Motorcycles TV', 'Tay ga Đình Tuấn', 'Auto2Tech'] as const;
const PRODUCTS = ['EASYSCAN', 'SCANBOX', 'KEYSCAN'];

function requireAdmin(actor: AuthUser) {
  if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Admin permission required');
}

@Injectable()
export class ActivationService {
  constructor(@InjectRepository(ActivationCode) private readonly records: Repository<ActivationCode>) {}

  async history(actor: AuthUser) {
    requireAdmin(actor);
    return this.records.find({ relations: { createdBy: true }, order: { createdAt: 'DESC' }, take: 100 });
  }

  async generate(dto: GenerateActivationDto, actor: AuthUser) {
    requireAdmin(actor);
    if (!PRODUCTS.includes(dto.product)) throw new BadRequestException('Sản phẩm không hợp lệ');
    if (!ACTIVATION_SOURCES.includes(dto.source as typeof ACTIVATION_SOURCES[number])) throw new BadRequestException('Nguồn đại lý không hợp lệ');
    const paymentStatus = dto.source === 'Auto2Tech' ? 'PAID' : dto.paymentStatus;
    if (!['PAID', 'UNPAID'].includes(paymentStatus)) throw new BadRequestException('Trạng thái thanh toán không hợp lệ');
    const result = calculateActivationCode(dto.product, dto.packageCode, dto.series);
    return this.records.save(this.records.create({ ...result, product: dto.product, packageCode: dto.packageCode, source: dto.source, paymentStatus, createdById: actor.id }));
  }

  async recognize(file: { buffer: Buffer; mimetype: string; size: number }, actor: AuthUser) {
    requireAdmin(actor);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Chỉ nhận ảnh JPEG, PNG hoặc WebP');
    const worker = await createWorker('eng');
    try {
      const straight=await sharp(file.buffer).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).grayscale().normalize().sharpen().png().toBuffer();
      const initial=await worker.recognize(straight);const initialCandidates=extractSeriesCandidates(initial.data.text);
      if(initialCandidates.length)return {candidates:initialCandidates,confidence:Math.round(initial.data.confidence),recognized:true};
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
      let bestConfidence=Math.round(initial.data.confidence);
      for(const angle of [-7,7,-14]){
        const image=await sharp(file.buffer).rotate(angle,{background:'#fff'}).resize({width:2600,withoutEnlargement:false}).grayscale().normalize().sharpen({sigma:1.5}).png().toBuffer();
        const {data}=await worker.recognize(image);bestConfidence=Math.max(bestConfidence,Math.round(data.confidence));
        const candidates=extractSeriesCandidates(data.text);
        if(candidates.length)return {candidates,confidence:Math.round(data.confidence),recognized:true};
      }
      return {candidates:[],confidence:bestConfidence,recognized:false};
    } finally {
      await worker.terminate();
    }
  }
}
