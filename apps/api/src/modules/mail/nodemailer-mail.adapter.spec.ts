import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { NodemailerMailAdapter } from "./nodemailer-mail.adapter";

jest.mock("nodemailer");

describe("NodemailerMailAdapter", () => {
  let adapter: NodemailerMailAdapter;
  let mockSendMail: jest.Mock;
  let mockTransporter: { sendMail: jest.Mock };

  beforeEach(() => {
    mockSendMail = jest.fn().mockResolvedValue({ messageId: "msg-123" });
    mockTransporter = { sendMail: mockSendMail };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          SMTP_HOST: "localhost",
          SMTP_PORT: 1025,
          SMTP_FROM: "no-reply@datria.local",
          MAILPIT_UI_URL: "http://localhost:8025",
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    adapter = new NodemailerMailAdapter(configService as never);
  });

  it("dispatches email through nodemailer transporter using default sender", async () => {
    await adapter.sendMail({
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "no-reply@datria.local",
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
    });
  });

  it("allows overriding the sender address", async () => {
    await adapter.sendMail({
      from: "custom@datria.local",
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "custom@datria.local",
      }),
    );
  });

  it("propagates delivery error when sending fails", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(
      adapter.sendMail({
        to: "recipient@example.com",
        subject: "Failing Subject",
        html: "<p>Hello</p>",
      }),
    ).rejects.toThrow("Connection refused");
  });
});
