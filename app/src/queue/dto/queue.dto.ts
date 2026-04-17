import { IsEmail, IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmailJobDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ example: 'Notification' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'You have a new notification' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class TaskExpirationCheckResultDto {
  @ApiProperty({ example: 5, description: 'Number of notifications sent' })
  @IsNumber()
  sent: number;

  @ApiProperty({ example: 0, description: 'Number of notifications failed' })
  @IsNumber()
  failed: number;

  @ApiProperty({ example: 5, description: 'Total tasks found' })
  @IsNumber()
  total: number;
}

export class QueueJobResultDto {
  @ApiProperty({ example: 5 })
  @IsNumber()
  processed: number;

  @ApiProperty({ example: 0, required: false })
  @IsNumber()
  failed?: number;
}
