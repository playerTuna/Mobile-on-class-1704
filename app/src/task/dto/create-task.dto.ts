import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Buy groceries', minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ example: 'Milk, eggs, and bread', minLength: 3 })
  @IsString()
  @MinLength(3)
  description!: string;

  @ApiProperty({
    example: '2026-04-20T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  due_date!: Date;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;
}
