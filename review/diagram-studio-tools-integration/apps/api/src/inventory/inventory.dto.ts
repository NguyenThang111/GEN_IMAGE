import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, IsUrl, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { InventoryTransactionType } from './inventory-transaction.entity';
import { PurchasePaymentStatus, PurchaseRequestStatus } from './purchase-request.entity';
import { FinishedProductTransactionType } from './finished-product-transaction.entity';
import { CANONICAL_INVENTORY_UNITS } from './inventory.policy';
import { InventoryBomKind } from './inventory-item.entity';
import { FinishedProductCategory } from './finished-product.entity';

export class RequestInventoryCountDto {
  @IsUUID() assigneeId!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class OpeningBalanceDto {
  @IsInt() @Min(0) quantity!: number;
  @IsString() @IsIn(CANONICAL_INVENTORY_UNITS) unit!: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateMovementDto {
  @IsEnum(InventoryTransactionType) type!: InventoryTransactionType;
  @IsInt() @Min(0) quantity!: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() reference?: string;
}

export class UpdateInventoryItemDto {
  @IsOptional() @IsEnum(InventoryBomKind) bomKind?: InventoryBomKind;
  @IsOptional() @IsString() @IsIn(CANONICAL_INVENTORY_UNITS) unit?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) groupName?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsInt() @Min(0) minimumStock?: number;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUrl({}, {each:true}) purchaseLinks?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateInventoryItemDto extends UpdateInventoryItemDto {
  @IsString() @MinLength(1) declare name: string;
  @IsString() @MinLength(1) declare groupName: string;
  @IsOptional() @IsInt() @Min(0) openingQuantity?: number;
}

export class CreatePurchaseRequestDto {
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsUUID() assignedBuyerId?: string | null;
}

export class UpdatePurchaseRequestDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsEnum(PurchaseRequestStatus) status?: PurchaseRequestStatus;
  @IsOptional() @IsInt() @Min(1) receivedQuantity?: number;
  @IsOptional() @IsEnum(PurchasePaymentStatus) paymentStatus?: PurchasePaymentStatus;
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(2000) orderUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(160) orderCode?: string | null;
  @IsOptional() @IsUUID() assignedBuyerId?: string | null;
}

export class CreateFinishedProductDto {
  @IsOptional() @IsString() @MinLength(1) sku?: string;
  @IsString() @MinLength(1) name!: string;
  @IsEnum(FinishedProductCategory) category!: FinishedProductCategory;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsInt() @Min(0) minimumStock?: number;
  @IsOptional() @IsInt() @Min(0) openingQuantity?: number;
}

export class UpdateFinishedProductDto {
  @IsOptional() @IsString() @MinLength(1) sku?: string;
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsEnum(FinishedProductCategory) category?: FinishedProductCategory;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsInt() @Min(0) minimumStock?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class FinishedProductMovementDto {
  @IsEnum(FinishedProductTransactionType) type!: FinishedProductTransactionType;
  @IsInt() @Min(0) quantity!: number;
  @IsOptional() @IsString() note?: string;
}

export class BomLineDto {
  @IsUUID() itemId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class ReplaceBomDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({each:true}) @Type(()=>BomLineDto) items!: BomLineDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>FinishedProductComponentLineDto) components?: FinishedProductComponentLineDto[];
}

export class FinishedProductComponentLineDto {
  @IsUUID() componentProductId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateSellableProductDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsInt() @Min(0) minimumStock?: number;
  @IsOptional() @IsInt() @Min(0) openingQuantity?: number;
}

export class UpdateSellableProductDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsInt() @Min(0) minimumStock?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SellableProductBomLineDto {
  @IsUUID() finishedProductId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class SellableProductMaterialLineDto {
  @IsUUID() itemId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class ReplaceSellableProductBomDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({each:true}) @Type(()=>SellableProductBomLineDto) items!: SellableProductBomLineDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({each:true}) @Type(()=>SellableProductMaterialLineDto) materials?: SellableProductMaterialLineDto[];
}

export class NormalizeInventoryItemDto {
  @IsUUID() itemId!: string;
  @IsInt() @Min(0) quantity!: number;
  @IsString() @IsIn(CANONICAL_INVENTORY_UNITS) unit!: string;
}

export class NormalizeInventoryBatchDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(127)
  @ValidateNested({ each: true }) @Type(() => NormalizeInventoryItemDto)
  items!: NormalizeInventoryItemDto[];
  @IsOptional() @IsString() note?: string;
}

export class MaterialPlanDto {
  @IsIn(['SELLABLE_PRODUCT', 'FINISHED_PRODUCT']) outputType!: 'SELLABLE_PRODUCT' | 'FINISHED_PRODUCT';
  @IsUUID() outputId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateStockCountSheetDto {
  @IsUUID() assigneeId!:string;
}

export class StockCountLineInputDto {
  @IsIn(['FINISHED_PRODUCT','SELLABLE_PRODUCT']) ownerType!:'FINISHED_PRODUCT'|'SELLABLE_PRODUCT';
  @IsUUID() ownerId!:string;
  @IsOptional() @IsNumber() @Min(0) countedQuantity?:number|null;
  @IsOptional() @IsString() @MaxLength(500) note?:string;
}

export class UpdateStockCountSheetDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(300) @ValidateNested({each:true}) @Type(()=>StockCountLineInputDto)
  lines!:StockCountLineInputDto[];
}
