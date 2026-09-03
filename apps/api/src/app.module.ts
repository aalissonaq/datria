import path from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "../../.env"),
        path.resolve(__dirname, "../../.env"),
        path.resolve(__dirname, "../../../.env"),
        ".env",
        "../../.env",
      ],
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
