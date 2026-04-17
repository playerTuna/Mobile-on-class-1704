import { ApiProperty } from '@nestjs/swagger';

export class UserInfoDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({ example: 'Alice' })
  name!: string;

  @ApiProperty({ example: 'alice@example.com', format: 'email' })
  email!: string;

  @ApiProperty({
    example: '2026-04-13T08:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at!: Date;
}
