import { ApiProperty } from '@nestjs/swagger';
import type { UUID } from 'crypto';

class TaskCategoryDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id!: UUID;

  @ApiProperty({ example: 'Work' })
  name!: string;
}

export class RetrieveTaskDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id!: UUID;

  @ApiProperty({ example: 'Buy groceries' })
  title!: string;

  @ApiProperty({ example: 'Milk, eggs, and bread' })
  description!: string;

  @ApiProperty({
    example: '2026-04-20T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  due_date!: Date;

  @ApiProperty({ example: 'pending' })
  status!: string;

  @ApiProperty({
    example: '2026-04-20T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at!: Date;

  @ApiProperty({ type: () => TaskCategoryDto, required: false, nullable: true })
  category?: TaskCategoryDto | null;
}
