import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';
@Module({ imports: [AuthModule, InventoryModule, FinanceModule], controllers: [ServiceController], providers: [ServiceService] })
export class ServiceModule {}
