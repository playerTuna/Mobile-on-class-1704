import { ApiProperty } from '@nestjs/swagger';
import { TokenDto } from './token.dto';
import { UserInfoDto } from './user-info.dto';

export class AuthResponseDto extends TokenDto {
  @ApiProperty({ type: () => UserInfoDto })
  user!: UserInfoDto;
}
