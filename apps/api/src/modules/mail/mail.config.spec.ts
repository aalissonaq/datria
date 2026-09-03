import { ConfigService } from "@nestjs/config";
import { createMailerConfig } from "./mail.config";
import { EnvironmentVariables } from "../../config/env.validation";

describe("mail.config", () => {
  it("creates mailer configuration with defaults pointing to Mailpit", () => {
    const configService = {
      get: jest.fn((key: keyof EnvironmentVariables) => {
        const values: Partial<EnvironmentVariables> = {
          SMTP_HOST: "localhost",
          SMTP_PORT: 1025,
          SMTP_FROM: "no-reply@datria.local",
          MAILPIT_UI_URL: "http://localhost:8025",
        };
        return values[key];
      }),
    } as unknown as ConfigService<EnvironmentVariables, true>;

    const config = createMailerConfig(configService);

    expect(config.defaults.from).toBe("no-reply@datria.local");
    expect(config.uiUrl).toBe("http://localhost:8025");
    expect(config.transport).toEqual(
      expect.objectContaining({
        host: "localhost",
        port: 1025,
        secure: false,
        ignoreTLS: true,
      }),
    );
  });
});
