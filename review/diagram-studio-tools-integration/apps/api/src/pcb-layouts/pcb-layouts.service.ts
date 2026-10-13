import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { UserRole } from '../users/user.entity';
import { UpdatePcbLayoutProgressDto } from './pcb-layout.dto';
import { PcbLayout, PcbLayoutProduct } from './pcb-layout.entity';

type HtmlUpload={originalname:string;mimetype:string;size:number;buffer:Buffer};

@Injectable()
export class PcbLayoutsService {
  constructor(@InjectRepository(PcbLayout) private readonly layouts:Repository<PcbLayout>,private readonly realtime:RealtimeGateway){}

  list(){return this.layouts.find({order:{product:'ASC'}});}

  async html(product:string){
    const normalized=this.product(product);
    const layout=await this.layouts.createQueryBuilder('layout').addSelect('layout.html').where('layout.product = :product',{product:normalized}).getOne();
    if(!layout)throw new NotFoundException('Chưa có PCB Layout cho sản phẩm này');
    return this.withBridge(layout.html.toString('utf8'),normalized);
  }

  async upload(product:string,file:HtmlUpload|undefined,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new ForbiddenException('Chỉ Admin được thay file PCB Layout');
    if(!file)throw new BadRequestException('File HTML là bắt buộc');
    const normalized=this.product(product);
    const html=file.buffer.toString('utf8');
    if(!file.originalname.toLowerCase().endsWith('.html')||!/<html[\s>]/i.test(html)||!/(Interactive BOM|var\s+(?:pcbdata|altiumbom)\s*=)/i.test(html))throw new BadRequestException('File phải là Interactive BOM HTML');
    const current=await this.layouts.findOneBy({product:normalized});
    const saved=await this.layouts.save(this.layouts.create({
      ...current,product:normalized,fileName:file.originalname,mimeType:'text/html',byteSize:file.size,html:file.buffer,
      progress:{},progressVersion:(current?.progressVersion??0)+1,createdById:current?.createdById??actor.id,updatedById:actor.id,
    }));
    this.realtime.emitTask('pcb-layout.updated',this.metadata(saved));
    return this.metadata(saved);
  }

  async updateProgress(product:string,dto:UpdatePcbLayoutProgressDto,actor:AuthUser){
    const normalized=this.product(product);
    const layout=await this.layouts.findOneBy({product:normalized});
    if(!layout)throw new NotFoundException('Chưa có PCB Layout cho sản phẩm này');
    layout.progress={...layout.progress,[dto.checkbox]:dto.refs};
    layout.progressVersion+=1;
    layout.updatedById=actor.id;
    const saved=await this.layouts.save(layout);
    const payload=this.metadata(saved);
    this.realtime.emitTask('pcb-layout.updated',payload);
    return payload;
  }

  private product(value:string){const product=value.toUpperCase() as PcbLayoutProduct;if(!Object.values(PcbLayoutProduct).includes(product))throw new BadRequestException('Sản phẩm PCB Layout không hợp lệ');return product;}
  private metadata(layout:PcbLayout){const {html:_,...safe}=layout;return safe;}
  private withBridge(html:string,product:PcbLayoutProduct){
    const clean=html
      .replace(/<!-- example header -->\s*<div[^>]*>\s*Hello header\s*<\/div>\s*<div[^>]*height:\s*calc\(100%\s*-\s*100px\)[^>]*>/i,'')
      .replace(/<!-- example footer -->\s*<\/div>\s*<div[^>]*>\s*Hello footer\s*<\/div>/i,'');
    const bridge=`<script>(function(){const SOURCE='auto2tech-pcb-layout',PRODUCT=${JSON.stringify(product)},timers={};function send(name){clearTimeout(timers[name]);timers[name]=setTimeout(function(){parent.postMessage({source:SOURCE,type:'progress-change',product:PRODUCT,checkbox:name,refs:(window.settings&&settings.checkboxStoredRefs&&settings.checkboxStoredRefs[name])||''},'*')},180)}window.addEventListener('message',function(e){const d=e.data||{};if(d.source!==SOURCE||d.type!=='progress-state'||d.product!==PRODUCT||!window.settings)return;Object.keys(d.progress||{}).forEach(function(name){settings.checkboxStoredRefs[name]=d.progress[name]||''});if(window.populateBomTable)populateBomTable()});window.addEventListener('load',function(){if(typeof EventHandler!=='undefined'&&typeof IBOM_EVENT_TYPES!=='undefined')EventHandler.registerCallback(IBOM_EVENT_TYPES.CHECKBOX_CHANGE_EVENT,function(e){if(e&&e.args&&(e.args.checkbox==='Sourced'||e.args.checkbox==='Placed'))send(e.args.checkbox)});parent.postMessage({source:SOURCE,type:'ready',product:PRODUCT},'*')})})();</script>`;
    return /<\/body>/i.test(clean)?clean.replace(/<\/body>/i,`${bridge}</body>`):clean+bridge;
  }
}
