import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UUID } from 'crypto';

export class RetrieveCategoryDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id!: UUID;

  @ApiProperty({ example: 'Work' })
  name!: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  color?: string;

  @ApiProperty({
    example: '2026-04-20T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at!: Date;
}
