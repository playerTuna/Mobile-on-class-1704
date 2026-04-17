import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';
import { InjectQueue } from '@nestjs/bullmq';
import { SendEmailDto } from '../email/dto/send-email.dto';
import { EmailJobDto } from './dto/queue.dto';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.TASK_EXPIRATION)
    private taskExpirationQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.scheduleTaskExpirationCheck();
  }

  async sendEmail(data: SendEmailDto): Promise<any> {
    const emailJobData: EmailJobDto = {
      to: data.to,
      subject: data.subject,
      message: data.message,
    };

    return await this.emailQueue.add('send-email', emailJobData, {
      attempts: 3,
      delay: 3000,
      removeOnComplete: 3,
    });
  }

  async scheduleTaskExpirationCheck() {
    try {
      const existingJobs = await this.taskExpirationQueue.getJobSchedulers();
      const existingJob = existingJobs.find(
        (job) => job.name === 'check-expiring-tasks',
      );

      if (existingJob?.id) {
        await this.taskExpirationQueue.removeJobScheduler(existingJob.id);
        this.logger.log('Removed previous scheduler');
      }

      const job = await this.taskExpirationQueue.add(
        'check-expiring-tasks',
        {},
        {
          repeat: { pattern: '*/1 * * * *' },
          removeOnComplete: true,
        },
      );

      this.logger.log('Task expiration check scheduled', {
        jobId: job.id,
        frequency: 'every 1 minute',
      });
    } catch (error) {
      this.logger.error('Failed to schedule task expiration check', error);
      throw error;
    }
  }
}
