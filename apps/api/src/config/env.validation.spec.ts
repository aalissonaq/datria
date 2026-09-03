import { validateEnvironment } from "./env.validation";

describe("environment validation", () => {
  it("rejects a missing database configuration without exposing values", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "test",
        API_PORT: "3000",
        WEB_ORIGIN: "http://localhost:5173",
      }),
    ).toThrow(/\[DATABASE_URL\]/);
  });

  it("rejects an invalid database configuration without echoing the secret", () => {
    const invalidSecret = "not-a-mysql-url-with-sensitive-material";

    expect(() =>
      validateEnvironment({
        NODE_ENV: "test",
        API_PORT: "3000",
        WEB_ORIGIN: "http://localhost:5173",
        DATABASE_URL: invalidSecret,
      }),
    ).toThrow(/must be a valid MySQL connection URI/);

    try {
      validateEnvironment({ DATABASE_URL: invalidSecret });
    } catch (error) {
      expect(String(error)).not.toContain(invalidSecret);
    }
  });

  it("rejects JWT_ACCESS_SECRET shorter than 32 characters", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: "mysql://root:@localhost:3306/datria_test",
        JWT_ACCESS_SECRET: "short-secret",
      }),
    ).toThrow(/JWT_ACCESS_SECRET must be at least 32 characters long/);
  });

  it("accepts valid environment configuration with defaults", () => {
    const config = validateEnvironment({
      DATABASE_URL: "mysql://root:@localhost:3306/datria_test",
      JWT_ACCESS_SECRET:
        "a-very-long-secret-key-that-satisfies-thirty-two-chars",
    });

    expect(config.DATABASE_URL).toBe(
      "mysql://root:@localhost:3306/datria_test",
    );
    expect(config.API_PORT).toBe(3000);
    expect(config.JWT_ISSUER).toBe("datria-api");
    expect(config.JWT_AUDIENCE).toBe("datria-web");
    expect(config.SMTP_PORT).toBe(1025);
    expect(config.AUDIT_RETENTION_DAYS).toBe(180);
    expect(config.COOKIE_SECURE).toBe(false);
  });
});
