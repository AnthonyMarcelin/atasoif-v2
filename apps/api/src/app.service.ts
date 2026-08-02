import { Injectable } from '@nestjs/common';
import { FREE_BOTTLE_LIMIT } from '@atasoif/shared';

@Injectable()
export class AppService {
  getHealth() {
    return {
      app: 'atasoif-api',
      version: '0.1.0',
      freeBottleLimit: FREE_BOTTLE_LIMIT,
      status: 'ok',
    };
  }
}
