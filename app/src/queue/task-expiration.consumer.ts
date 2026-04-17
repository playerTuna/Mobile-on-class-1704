import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './queue.constants';
import { Job } from 'bullmq';
import { EmailService } from '../email/email.service';
import { TaskExpirationCheckResultDto } from './dto/queue.dto';
import { SendEmailDto } from '../email/dto/send-email.dto';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type ExpiringTaskRow = {
  title: string;
  due_date: Date | null;
  user_email: string;
};

@Processor(QUEUE_NAMES.TASK_EXPIRATION)
export class TaskExpirationConsumer extends WorkerHost {
  private readonly logger = new Logger(TaskExpirationConsumer.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<TaskExpirationCheckResultDto> {
    try {
      this.logger.debug('Starting check', { jobId: job.id });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(23, 59, 59, 999);

      const expiringTasks = await this.db.query<ExpiringTaskRow>(
        `SELECT t.title, t.due_date, u.email AS user_email
         FROM tasks t
         INNER JOIN users u ON u.id = t.user_id
         WHERE t.due_date >= $1
           AND t.due_date <= $2`,
        [today, threeDaysFromNow],
      );

      this.logger.log('Found expiring tasks', {
        count: expiringTasks.rows.length,
      });

      if (expiringTasks.rows.length === 0) {
        return { sent: 0, failed: 0, total: 0 };
      }

      const emailRequests: SendEmailDto[] = expiringTasks.rows.map((task) => ({
        to: task.user_email,
        subject: `Task Expiration: ${task.title}`,
        message: `The task "${task.title}" is due to expire on ${task.due_date?.toLocaleDateString()}.`,
      }));

      const emailResults = await Promise.allSettled(
        emailRequests.map((email) => this.emailService.sendEmail(email)),
      );

      const succeeded = emailResults.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const failed = emailResults.filter((r) => r.status === 'rejected').length;

      emailResults.forEach((result, idx) => {
        if (result.status === 'rejected') {
          this.logger.warn('Failed to send notification', {
            taskTitle: expiringTasks.rows[idx].title,
            email: expiringTasks.rows[idx].user_email,
          });
        }
      });

      const result: TaskExpirationCheckResultDto = {
        sent: succeeded,
        failed,
        total: expiringTasks.rows.length,
      };

      this.logger.log('Check completed', result);

      return result;
    } catch (error) {
      this.logger.error('Check failed', error, { jobId: job.id });
      throw error;
    }
  }
}
