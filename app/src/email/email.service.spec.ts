import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { BadRequestException } from '@nestjs/common';

describe('EmailService', () => {
  let service: EmailService;
  let mailerService: MailerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    mailerService = module.get<MailerService>(MailerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test message',
      };

      (mailerService.sendMail as jest.Mock).mockResolvedValue({
        response: '250 Message accepted',
      });

      await service.sendEmail(emailData);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.message,
      });
      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for invalid email', async () => {
      const emailData = {
        to: 'invalid-email',
        subject: 'Test Subject',
        message: 'Test message',
      };

      await expect(service.sendEmail(emailData)).rejects.toThrow(
        BadRequestException,
      );
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should handle mailer service errors', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test message',
      };

      (mailerService.sendMail as jest.Mock).mockRejectedValue(
        new Error('SMTP connection failed'),
      );

      await expect(service.sendEmail(emailData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('sendEmailWithTemplate', () => {
    it('should send templated email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Welcome',
        template: 'welcome',
        context: { name: 'John' },
      };

      (mailerService.sendMail as jest.Mock).mockResolvedValue({
        response: '250 Message accepted',
      });

      await service.sendEmailWithTemplate(emailData);

      expect(mailerService.sendMail).toHaveBeenCalledWith({
        to: emailData.to,
        subject: emailData.subject,
        template: emailData.template,
        context: emailData.context,
      });
    });

    it('should throw BadRequestException for invalid email in template', async () => {
      const emailData = {
        to: 'invalid',
        subject: 'Welcome',
        template: 'welcome',
        context: { name: 'John' },
      };

      await expect(service.sendEmailWithTemplate(emailData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
