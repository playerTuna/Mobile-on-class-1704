import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service';

@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Check health of the application
  @Get('health')
  getHealth(): string {
    return this.appService.getHealth();
  }

  @Get('test')
  getTest(): string {
    return this.appService.getTest();
  }
}
