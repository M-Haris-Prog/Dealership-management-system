import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CashierController } from './cashier.controller';
import { CashierService } from './cashier.service';
@Module({ imports: [AuthModule], controllers: [CashierController], providers: [CashierService] })
export class CashierModule {}
