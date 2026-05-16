import { Module } from '@nestjs/common';
import { LgpdController } from './lgpd.controller';

@Module({
  controllers: [LgpdController],
})
export class LgpdModule {}
