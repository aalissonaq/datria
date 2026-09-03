import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

export class RegisterRequestDto {
  @ApiProperty({ example: "Maria Silva", minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  displayName!: string;

  @ApiProperty({ example: "maria.silva@exemplo.edu.br" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "SenhaForte#2026", minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiProperty({ example: "v1.0", minLength: 1, maxLength: 40 })
  @IsString()
  @Length(1, 40)
  termsVersion!: string;
}

export class VerifyEmailRequestDto {
  @ApiProperty({ description: "64-character raw hex token" })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationRequestDto {
  @ApiProperty({ example: "maria.silva@exemplo.edu.br" })
  @IsEmail()
  email!: string;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}

export class LoginRequestDto {
  @ApiProperty({ example: "maria.silva@exemplo.edu.br" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "SenhaForte#2026" })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  displayName!: string;
}

export class LoginResponseDto {
  @ApiProperty()
  user!: UserResponseDto;
}

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: "maria.silva@exemplo.edu.br" })
  @IsEmail()
  email!: string;
}

export class ResetPasswordRequestDto {
  @ApiProperty({
    description: "64-character raw hex token or token hash",
    required: false,
  })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiProperty({
    description: "Direct token hash if passing SHA-256 directly",
    required: false,
  })
  @IsOptional()
  @IsString()
  tokenHash?: string;

  @ApiProperty({ example: "NovaSenhaForte#2026", minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  newPassword!: string;
}
