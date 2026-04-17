import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './queue.constants';
import { Job } from 'bullmq';
import { EmailService } from '../email/email.service';
import { EmailJobDto } from './dto/queue.dto';
import { Logger } from '@nestjs/common';

@Processor(QUEUE_NAMES.EMAIL)
export class QueueConsumer extends WorkerHost {
  private readonly logger = new Logger(QueueConsumer.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobDto>): Promise<any> {
    try {
      this.logger.log('Processing job', {
        jobId: job.id,
        to: job.data.to,
      });

      await this.emailService.sendEmail(job.data);

      this.logger.log('Job completed', { jobId: job.id });
    } catch (error) {
      this.logger.error('Job failed', error, { jobId: job.id });
      throw error;
    }
  }
}
