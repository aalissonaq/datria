import { plainToInstance, Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  validateSync,
} from "class-validator";

export enum Environment {
  Development = "development",
  Production = "production",
  Test = "test",
}

export class EnvironmentVariables {
  @IsEnum(Environment, {
    message: "NODE_ENV must be one of: development, production, test",
  })
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber({}, { message: "API_PORT must be a valid number" })
  @IsOptional()
  API_PORT: number = 3000;

  @IsString({ message: "WEB_ORIGIN must be a valid origin string" })
  @IsOptional()
  WEB_ORIGIN: string = "http://localhost:5173";

  @IsString({ message: "DATABASE_URL is required" })
  @Matches(/^mysql:\/\/.+/, {
    message:
      "DATABASE_URL must be a valid MySQL connection URI starting with mysql://",
  })
  DATABASE_URL!: string;

  @IsString({ message: "TEST_DATABASE_URL must be a valid connection string" })
  @IsOptional()
  TEST_DATABASE_URL?: string;

  @IsString({ message: "JWT_ACCESS_SECRET is required" })
  @MinLength(32, {
    message: "JWT_ACCESS_SECRET must be at least 32 characters long",
  })
  JWT_ACCESS_SECRET: string =
    "datria_development_super_secret_access_key_at_least_32_bytes_long";

  @IsString({ message: "JWT_ISSUER must be a string" })
  @IsOptional()
  JWT_ISSUER: string = "datria-api";

  @IsString({ message: "JWT_AUDIENCE must be a string" })
  @IsOptional()
  JWT_AUDIENCE: string = "datria-web";

  @IsString({ message: "ACCESS_TOKEN_TTL must be a string" })
  @IsOptional()
  ACCESS_TOKEN_TTL: string = "15m";

  @IsString({ message: "SESSION_IDLE_TTL must be a string" })
  @IsOptional()
  SESSION_IDLE_TTL: string = "30m";

  @IsString({ message: "SESSION_ABSOLUTE_TTL must be a string" })
  @IsOptional()
  SESSION_ABSOLUTE_TTL: string = "8h";

  @IsString({ message: "EMAIL_VERIFICATION_TTL must be a string" })
  @IsOptional()
  EMAIL_VERIFICATION_TTL: string = "24h";

  @IsString({ message: "PASSWORD_RESET_TTL must be a string" })
  @IsOptional()
  PASSWORD_RESET_TTL: string = "30m";

  @IsString({ message: "INVITATION_TTL must be a string" })
  @IsOptional()
  INVITATION_TTL: string = "7d";

  @IsString({ message: "SMTP_HOST must be a string" })
  @IsOptional()
  SMTP_HOST: string = "localhost";

  @IsNumber({}, { message: "SMTP_PORT must be a valid number" })
  @IsOptional()
  SMTP_PORT: number = 1025;

  @IsString({ message: "SMTP_FROM must be a valid sender address" })
  @IsOptional()
  SMTP_FROM: string = "no-reply@datria.local";

  @IsString({ message: "MAILPIT_UI_URL must be a string" })
  @IsOptional()
  MAILPIT_UI_URL: string = "http://localhost:8025";

  @IsNumber({}, { message: "AUDIT_RETENTION_DAYS must be a valid number" })
  @IsOptional()
  AUDIT_RETENTION_DAYS: number = 180;

  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean({ message: "COOKIE_SECURE must be a boolean" })
  @IsOptional()
  COOKIE_SECURE: boolean = false;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((err) => {
        const constraints = err.constraints
          ? Object.values(err.constraints)
          : [];
        return `[${err.property}]: ${constraints.join("; ")}`;
      })
      .join("\n");

    // Do NOT print actual values of config to prevent secret leakage
    throw new Error(
      `Configuration validation failed. Please check your environment configuration:\n${errorMessages}`,
    );
  }

  return validatedConfig;
}
