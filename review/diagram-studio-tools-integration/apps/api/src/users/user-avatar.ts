import { BadRequestException } from '@nestjs/common';
const sharp = require('sharp') as (input:Buffer,options?:{limitInputPixels:number})=>import('sharp').Sharp;

export async function normalizeUserAvatar(file:{buffer:Buffer;mimetype:string;size:number}){
  const formats:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
  if(!formats[file.mimetype]||file.size>3*1024*1024||file.buffer.length>3*1024*1024)throw new BadRequestException('Chọn ảnh JPG, PNG hoặc WebP tối đa 3 MB');
  try{
    const input=sharp(file.buffer,{limitInputPixels:16_000_000});
    const meta=await input.metadata();
    if(meta.format!==formats[file.mimetype]||(meta.pages??1)>1)throw new Error('Invalid format');
    const data=await input.rotate().resize(192,192,{fit:'cover'}).webp({quality:80}).toBuffer();
    return `data:image/webp;base64,${data.toString('base64')}`;
  }catch{throw new BadRequestException('Ảnh không hợp lệ hoặc vượt 16 triệu pixel');}
}
