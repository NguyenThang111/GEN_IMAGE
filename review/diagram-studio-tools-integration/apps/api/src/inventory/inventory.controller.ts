import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { RequestInventoryCountDto, CreateFinishedProductDto, CreateInventoryItemDto, CreateMovementDto, CreatePurchaseRequestDto, CreateSellableProductDto, CreateStockCountSheetDto, FinishedProductMovementDto, MaterialPlanDto, NormalizeInventoryBatchDto, OpeningBalanceDto, ReplaceBomDto, ReplaceSellableProductBomDto, UpdateFinishedProductDto, UpdateInventoryItemDto, UpdatePurchaseRequestDto, UpdateSellableProductDto, UpdateStockCountSheetDto } from './inventory.dto';
import { InventoryService } from './inventory.service';
import { InventoryImageOwnerType } from './inventory-image.entity';

type AuthRequest=Request&{user:AuthUser};
type UploadedInventoryFile={buffer:Buffer;mimetype:string;size:number};
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory:InventoryService){}
  @Get('items') items(@Query('includeInactive') includeInactive?:string){return this.inventory.findItems(includeInactive==='true');}
  @Get('bom-audit') bomAudit(){return this.inventory.bomAudit();}
  @Post('material-plan') materialPlan(@Body() dto:MaterialPlanDto){return this.inventory.materialPlan(dto);}
  @Get('stock-count-sheets') stockCountSheets(){return this.inventory.findStockCountSheets();}
  @Post('stock-count-sheets') createStockCountSheet(@Body() dto:CreateStockCountSheetDto,@Req() req:AuthRequest){return this.inventory.createStockCountSheet(dto,req.user);}
  @Patch('stock-count-sheets/:id') updateStockCountSheet(@Param('id') id:string,@Body() dto:UpdateStockCountSheetDto,@Req() req:AuthRequest){return this.inventory.updateStockCountSheet(id,dto,req.user);}
  @Post('stock-count-sheets/:id/submit') submitStockCountSheet(@Param('id') id:string,@Req() req:AuthRequest){return this.inventory.submitStockCountSheet(id,req.user);}
  @Post('stock-count-sheets/:id/finalize') finalizeStockCountSheet(@Param('id') id:string,@Req() req:AuthRequest){return this.inventory.finalizeStockCountSheet(id,req.user);}
  @Post('items') createItem(@Body() dto:CreateInventoryItemDto,@Req() req:AuthRequest){return this.inventory.createItem(dto,req.user);}
  @Get('items/:id/transactions') transactions(@Param('id') id:string){return this.inventory.findTransactions(id);}
  @Get('items/:id/audits') audits(@Param('id') id:string){return this.inventory.findAudits(id);}
  @Post('items/:id/opening-balance') opening(@Param('id') id:string,@Body() dto:OpeningBalanceDto,@Req() req:AuthRequest){return this.inventory.openingBalance(id,dto,req.user);}
  @Post('normalize') normalize(@Body() dto:NormalizeInventoryBatchDto,@Req() req:AuthRequest){return this.inventory.normalizeBatch(dto,req.user);}
  @Post('items/:id/movements') movement(@Param('id') id:string,@Body() dto:CreateMovementDto,@Req() req:AuthRequest){return this.inventory.movement(id,dto,req.user);}
  @Patch('items/:id') update(@Param('id') id:string,@Body() dto:UpdateInventoryItemDto,@Req() req:AuthRequest){return this.inventory.update(id,dto,req.user);}
  @Delete('items/:id') removeItem(@Param('id') id:string,@Req() req:AuthRequest){return this.inventory.removeItem(id,req.user);}
  @Post('items/:id/request-count') requestCount(@Param('id') id:string,@Body() dto:RequestInventoryCountDto,@Req() req:AuthRequest){return this.inventory.requestCount(id,dto,req.user);}
  @Get('purchase-requests') requests(){return this.inventory.findPurchaseRequests();}
  @Post('items/:id/purchase-requests') createRequest(@Param('id') id:string,@Body() dto:CreatePurchaseRequestDto,@Req() req:AuthRequest){return this.inventory.createPurchaseRequest(id,dto,req.user);}
  @Patch('purchase-requests/:id') updateRequest(@Param('id') id:string,@Body() dto:UpdatePurchaseRequestDto,@Req() req:AuthRequest){return this.inventory.updatePurchaseRequest(id,dto,req.user);}
  @Delete('purchase-requests/:id') removeRequest(@Param('id') id:string){return this.inventory.removePurchaseRequest(id);}
  @Get('finished-items') finishedItems(){return this.inventory.findProducts();}
  @Post('finished-items') createFinishedItem(@Body() dto:CreateFinishedProductDto,@Req() req:AuthRequest){return this.inventory.createProduct(dto,req.user);}
  @Patch('finished-items/:id') updateFinishedItem(@Param('id') id:string,@Body() dto:UpdateFinishedProductDto){return this.inventory.updateProduct(id,dto);}
  @Delete('finished-items/:id') removeFinishedItem(@Param('id') id:string,@Req() req:AuthRequest){return this.inventory.removeProduct(id,req.user);}
  @Get('finished-items/:id/transactions') finishedItemHistory(@Param('id') id:string){return this.inventory.productHistory(id);}
  @Post('finished-items/:id/movements') finishedItemMovement(@Param('id') id:string,@Body() dto:FinishedProductMovementDto,@Req() req:AuthRequest){return this.inventory.productMovement(id,dto,req.user);}
  @Patch('finished-items/:id/bom') replaceFinishedItemBom(@Param('id') id:string,@Body() dto:ReplaceBomDto){return this.inventory.replaceBom(id,dto);}
  @Get('products') products(){return this.inventory.findSellableProducts();}
  @Post('products') createProduct(@Body() dto:CreateSellableProductDto,@Req() req:AuthRequest){return this.inventory.createSellableProduct(dto,req.user);}
  @Patch('products/:id') updateProduct(@Param('id') id:string,@Body() dto:UpdateSellableProductDto){return this.inventory.updateSellableProduct(id,dto);}
  @Delete('products/:id') removeProduct(@Param('id') id:string,@Req() req:AuthRequest){return this.inventory.removeSellableProduct(id,req.user);}
  @Get('products/:id/transactions') productHistory(@Param('id') id:string){return this.inventory.sellableProductHistory(id);}
  @Post('products/:id/movements') productMovement(@Param('id') id:string,@Body() dto:FinishedProductMovementDto,@Req() req:AuthRequest){return this.inventory.sellableProductMovement(id,dto,req.user);}
  @Patch('products/:id/bom') replaceProductBom(@Param('id') id:string,@Body() dto:ReplaceSellableProductBomDto){return this.inventory.replaceSellableProductBom(id,dto);}
  @Get('images/:ownerType/:ownerId') async image(@Param('ownerType') ownerType:string,@Param('ownerId') ownerId:string,@Res() response:Response){const image=await this.inventory.getImage(ownerType as InventoryImageOwnerType,ownerId);response.setHeader('Content-Type',image.mimeType);response.setHeader('Cache-Control','private, no-store');response.send(image.data);}
  @Put('images/:ownerType/:ownerId') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:600*1024}})) uploadImage(@Param('ownerType') ownerType:string,@Param('ownerId') ownerId:string,@UploadedFile() file:UploadedInventoryFile|undefined,@Req() req:AuthRequest){if(!file)throw new BadRequestException('Image file is required');return this.inventory.saveImage(ownerType as InventoryImageOwnerType,ownerId,file,req.user);}
  @Delete('images/:ownerType/:ownerId') removeImage(@Param('ownerType') ownerType:string,@Param('ownerId') ownerId:string){return this.inventory.removeImage(ownerType as InventoryImageOwnerType,ownerId);}
}
