import { ActivationPaymentStatus, ActivationProduct } from './activation.entity';
export type GenerateActivationDto={series:string;product:ActivationProduct;packageCode:string;source:string;paymentStatus:ActivationPaymentStatus};
