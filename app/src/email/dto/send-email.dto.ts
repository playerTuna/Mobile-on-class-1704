import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ example: 'Welcome' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'Welcome to our app!' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class SendEmailWithTemplateDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ example: 'Welcome' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'welcome' })
  @IsString()
  @IsNotEmpty()
  template: string;

  @ApiProperty({ example: { name: 'John' } })
  @IsNotEmpty()
  context: Record<string, any>;
}
