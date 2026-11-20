import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoundationController } from './foundation.controller';
import { FoundationService } from './foundation.service';

@Module({
  imports: [AuthModule],
  controllers: [FoundationController],
  providers: [FoundationService],
})
export class FoundationModule {}
