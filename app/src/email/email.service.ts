import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SendEmailDto, SendEmailWithTemplateDto } from './dto/send-email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(data: SendEmailDto): Promise<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.to)) {
      throw new BadRequestException(`Invalid email address: ${data.to}`);
    }

    try {
      await this.mailerService.sendMail({
        to: data.to,
        subject: data.subject,
        text: data.message,
      });

      this.logger.log('Email sent', {
        to: data.to,
        subject: data.subject,
      });
    } catch (error) {
      this.logger.error('Failed to send email', error, {
        to: data.to,
      });
      throw new BadRequestException(`Failed to send email: ${error.message}`);
    }
  }

  async sendEmailWithTemplate(data: SendEmailWithTemplateDto): Promise<void> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.to)) {
      throw new BadRequestException(`Invalid email address: ${data.to}`);
    }

    try {
      await this.mailerService.sendMail({
        to: data.to,
        subject: data.subject,
        template: data.template,
        context: data.context,
      });

      this.logger.log('Templated email sent', {
        to: data.to,
        template: data.template,
      });
    } catch (error) {
      this.logger.error('Failed to send templated email', error, {
        to: data.to,
      });
      throw new BadRequestException(`Failed to send email: ${error.message}`);
    }
  }
}
