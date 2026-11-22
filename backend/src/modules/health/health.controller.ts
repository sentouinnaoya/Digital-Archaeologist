import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(getConnectionToken()) private readonly connection: Connection,
  ) {}

  @Get()
  check() {
    const mongoUp = this.connection.readyState === 1;
    if (!mongoUp) {
      throw new ServiceUnavailableException('MongoDB is not connected');
    }
    return {
      status: 'ok',
      mongodb: { status: 'up' },
      timestamp: new Date().toISOString(),
    };
  }
}
