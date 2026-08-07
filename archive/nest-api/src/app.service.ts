import { Injectable } from '@nestjs/common';
import { FREE_BOTTLE_LIMIT } from '@atasoif/shared';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let database: 'up' | 'down' = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      app: 'atasoif-api',
      version: '0.1.0',
      freeBottleLimit: FREE_BOTTLE_LIMIT,
      database,
      status: database === 'up' ? 'ok' : 'degraded',
    };
  }
}
