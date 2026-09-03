import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";

export interface GeneratedToken {
  rawToken: string;
  tokenHash: string;
}

@Injectable()
export class TokenService {
  /**
   * Generates a 32-byte (256-bit) cryptographically random URL-safe token
   * and returns both the raw token (to be sent via email/cookie) and its SHA-256 hash.
   */
  generateSecureToken(): GeneratedToken {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    return { rawToken, tokenHash };
  }

  /**
   * Computes deterministic SHA-256 hash of a raw token.
   * Only this hash is stored in the database.
   */
  hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
  }

  /**
   * Performs constant-time comparison between raw token and expected hash to prevent timing attacks.
   */
  compareToken(rawToken: string, expectedHash: string): boolean {
    if (!rawToken || !expectedHash) {
      return false;
    }

    const computedHash = this.hashToken(rawToken);
    const computedBuf = Buffer.from(computedHash, "hex");
    const expectedBuf = Buffer.from(expectedHash, "hex");

    if (computedBuf.length !== expectedBuf.length) {
      return false;
    }

    return timingSafeEqual(computedBuf, expectedBuf);
  }

  /**
   * Parses time string like "15m", "30m", "8h", "24h", "7d" into milliseconds.
   */
  parseDurationToMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Unsupported duration unit: ${unit}`);
    }
  }

  calculateExpiresAt(duration: string, fromDate = new Date()): Date {
    const ms = this.parseDurationToMs(duration);
    return new Date(fromDate.getTime() + ms);
  }
}
