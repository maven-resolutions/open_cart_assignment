import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const apiUser = this.configService.get<string>('auth.apiUser');
    const apiPasswordHash = this.configService.get<string>(
      'auth.apiPasswordHash',
    );

    if (!apiUser || !apiPasswordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (dto.username !== apiUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, apiPasswordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: apiUser,
      username: apiUser,
    });

    return { accessToken };
  }
}
