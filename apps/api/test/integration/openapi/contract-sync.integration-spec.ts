import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../../../src/app.module";

describe("OpenAPI Contract Synchronization (Integration)", () => {
  let app: INestApplication;
  let openApiDoc: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");

    const config = new DocumentBuilder()
      .setTitle("Datria API")
      .setVersion("0.2.0")
      .build();

    openApiDoc = SwaggerModule.createDocument(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("generates a valid OpenAPI 3.0 document with expected schemas and endpoints", () => {
    expect(openApiDoc).toBeDefined();
    expect(openApiDoc.openapi).toMatch(/^3\./);
    expect(openApiDoc.paths).toBeDefined();
  });

  it("includes all key identity and authentication paths", () => {
    const paths = Object.keys(openApiDoc.paths);

    expect(paths).toContain("/api/v1/auth/register");
    expect(paths).toContain("/api/v1/auth/verify-email");
    expect(paths).toContain("/api/v1/auth/login");
    expect(paths).toContain("/api/v1/auth/logout");
    expect(paths).toContain("/api/v1/auth/refresh");
    expect(paths).toContain("/api/v1/auth/forgot-password");
    expect(paths).toContain("/api/v1/auth/reset-password");
    expect(paths).toContain("/api/v1/auth/csrf");
  });

  it("includes organization, membership, and invitation paths", () => {
    const paths = Object.keys(openApiDoc.paths);

    expect(paths).toContain("/api/v1/me/contexts");
    expect(paths).toContain("/api/v1/organizations");
    expect(paths).toContain(
      "/api/v1/organizations/{organizationId}/invitations",
    );
    expect(paths).toContain("/api/v1/invitations/{token}/accept");
    expect(paths).toContain("/api/v1/organizations/{organizationId}/members");
  });

  it("includes platform administration paths", () => {
    const paths = Object.keys(openApiDoc.paths);

    expect(paths).toContain("/api/v1/platform/organizations");
    expect(paths).toContain(
      "/api/v1/platform/organizations/{organizationId}/status",
    );
  });
});
