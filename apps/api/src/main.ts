import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>("API_PORT") || 3000;
  const webOrigin =
    configService.get<string>("WEB_ORIGIN") || "http://localhost:5173";

  // Configure CORS
  app.enableCors({
    origin: webOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // Global routing prefix
  app.setGlobalPrefix("api/v1");

  // OpenAPI Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Datria Foundation API")
    .setDescription(
      "Operational API endpoints for Datria codename project foundation",
    )
    .setVersion("0.1.0")
    .addTag("Health", "Health and readiness verification endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/v1/docs", app, document);

  await app.listen(port);
  logger.log(`Datria API service running on: http://localhost:${port}/api/v1`);
  logger.log(
    `OpenAPI documentation available on: http://localhost:${port}/api/v1/docs`,
  );
}

bootstrap().catch((err) => {
  // Output sanitized error message without leaking sensitive environment contents
  console.error("Fatal error during API bootstrap:", err.message || err);
  process.exit(1);
});
