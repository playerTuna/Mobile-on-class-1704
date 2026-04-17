import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'OK';
  }

  getTest(): string {
    return 'This is a test endpoint';
  }
}
