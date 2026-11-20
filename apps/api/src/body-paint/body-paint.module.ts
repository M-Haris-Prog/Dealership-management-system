import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BodyPaintController } from './body-paint.controller';
import { BodyPaintService } from './body-paint.service';
@Module({ imports: [AuthModule], controllers: [BodyPaintController], providers: [BodyPaintService] })
export class BodyPaintModule {}
