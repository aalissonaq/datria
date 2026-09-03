import { TokenService } from "./token.service";

describe("TokenService", () => {
  let service: TokenService;

  beforeEach(() => {
    service = new TokenService();
  });

  it("generates a random raw token with at least 64 hex characters and matching SHA-256 hash", () => {
    const { rawToken, tokenHash } = service.generateSecureToken();

    expect(rawToken).toHaveLength(64);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).toBe(service.hashToken(rawToken));
  });

  it("generates distinct tokens across subsequent calls", () => {
    const token1 = service.generateSecureToken();
    const token2 = service.generateSecureToken();

    expect(token1.rawToken).not.toBe(token2.rawToken);
    expect(token1.tokenHash).not.toBe(token2.tokenHash);
  });

  it("compares token and hash correctly and timing-safely", () => {
    const { rawToken, tokenHash } = service.generateSecureToken();

    expect(service.compareToken(rawToken, tokenHash)).toBe(true);
    expect(service.compareToken("wrongToken", tokenHash)).toBe(false);
    expect(
      service.compareToken(
        rawToken,
        "0000000000000000000000000000000000000000000000000000000000000000",
      ),
    ).toBe(false);
  });

  it("correctly parses durations to milliseconds and calculates future expiry", () => {
    expect(service.parseDurationToMs("15m")).toBe(15 * 60 * 1000);
    expect(service.parseDurationToMs("30m")).toBe(30 * 60 * 1000);
    expect(service.parseDurationToMs("8h")).toBe(8 * 60 * 60 * 1000);
    expect(service.parseDurationToMs("24h")).toBe(24 * 60 * 60 * 1000);
    expect(service.parseDurationToMs("7d")).toBe(7 * 24 * 60 * 60 * 1000);

    const now = new Date("2026-09-03T12:00:00.000Z");
    const expiresAt = service.calculateExpiresAt("30m", now);
    expect(expiresAt.toISOString()).toBe("2026-09-03T12:30:00.000Z");
  });
});
