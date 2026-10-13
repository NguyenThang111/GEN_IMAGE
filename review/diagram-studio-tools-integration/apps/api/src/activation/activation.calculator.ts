import { BadRequestException } from '@nestjs/common';
import { ActivationProduct } from './activation.entity';
export const ACTIVATION_PACKAGES={SCANBOX:{YAMAHA_VESPA_FLASH:2,SMARTKEY:3},KEYSCAN:{KLINE_ECU:2,RH850:4},EASYSCAN:{V2:[7,10,2],V3:[8,10,6],V2_PLUS:[77,10,2],V3_PLUS:[88,10,6]}} as const;
export function parseDeviceSeries(input:string){const parts=`${input||''}`.trim().split(/[-:\s]+/).filter(Boolean);if(parts.length!==8)throw new BadRequestException('Series phải có đúng 8 byte HEX');const bytes=parts.map(part=>{if(!/^[0-9a-fA-F]{1,2}$/.test(part))throw new BadRequestException(`Byte Series không hợp lệ: ${part}`);return parseInt(part,16);});return {bytes,normalized:bytes.map(byte=>byte.toString(16).toUpperCase().padStart(2,'0')).join('-')};}
export function getSeriesFactor(bytes:number[]){const sum8=bytes.reduce((sum,byte)=>sum+(byte&0xff),0)&0xff;return (sum8^0xff)+1;}
export function extractSeriesCandidates(text:string){
  const normalized=text.replace(/[–—]/g,'-');
  const strict=[...normalized.matchAll(/(?:^|[^0-9A-Fa-f])((?:[0-9A-Fa-f]{1,2}[-:]){7}[0-9A-Fa-f]{1,2})(?![0-9A-Fa-f])/gm)].map(match=>match[1]);
  const spaced=strict.length?[]:(normalized.match(/(?:[0-9A-Fa-f]{1,2}\s+){7}[0-9A-Fa-f]{1,2}/g)??[]);
  return [...new Set([...strict,...spaced].flatMap(value=>{try{return [parseDeviceSeries(value).normalized];}catch{return [];}}))];
}
export function calculateActivationCode(product:ActivationProduct,packageCode:string,series:string){const {bytes,normalized}=parseDeviceSeries(series);const factor=getSeriesFactor(bytes);let code:number;if(product==='SCANBOX'||product==='KEYSCAN'){const active=(ACTIVATION_PACKAGES[product] as Record<string,number>)[packageCode];if(active===undefined)throw new BadRequestException('Gói kích hoạt không hợp lệ cho sản phẩm');code=factor*(active+1)*active*active+7;}else{const version=(ACTIVATION_PACKAGES.EASYSCAN as Record<string,readonly number[]>)[packageCode];if(!version)throw new BadRequestException('Gói kích hoạt không hợp lệ cho sản phẩm');const [major,release,fixed]=version;code=major===77||major===88?factor*((major/11)*fixed)*(release+major/11+fixed):factor*(major*fixed)*(release+major);}return {series:normalized,activationCode:String(code)};}
