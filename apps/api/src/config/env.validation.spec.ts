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
});
