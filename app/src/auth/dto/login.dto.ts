import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'dio@example.com', format: 'email' })
  @IsString()
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'hashed_password_1', minLength: 8, maxLength: 32 })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password!: string;
}
