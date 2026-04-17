import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SendEmailDto, SendEmailWithTemplateDto } from './dto/send-email.dto';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a test email' })
  async sendTestEmail(@Body() data: SendEmailDto) {
    await this.emailService.sendEmail(data);
    return { success: true, message: 'Email sent successfully' };
  }

  @Post('send-template')
  @ApiOperation({ summary: 'Send a templated email' })
  async sendTemplateEmail(@Body() data: SendEmailWithTemplateDto) {
    await this.emailService.sendEmailWithTemplate(data);
    return { success: true, message: 'Templated email sent successfully' };
  }
}
