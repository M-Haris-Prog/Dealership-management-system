import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { FinanceModule } from './finance/finance.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { PartsModule } from './parts/parts.module';
import { ServiceModule } from './service/service.module';
import { BodyPaintModule } from './body-paint/body-paint.module';
import { CashierModule } from './cashier/cashier.module';
import { ReportingModule } from './reporting/reporting.module';
import { FoundationModule } from './foundation/foundation.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    FinanceModule,
    InventoryModule,
    SalesModule,
    PartsModule,
    ServiceModule,
    BodyPaintModule,
    CashierModule,
    ReportingModule,
    FoundationModule,
  ],
})
export class AppModule {}
