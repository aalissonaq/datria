import { plainToInstance } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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
