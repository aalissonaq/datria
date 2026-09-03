import * as argon2 from "argon2";
import type { HashOptions } from "argon2";
import { Injectable } from "@nestjs/common";
import { ValidationErrorException } from "../../../common/exceptions/domain.exception";

export const ARGON2_OPTIONS: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

// Common compromised passwords blocklist (case-insensitive check)
export const COMMON_PASSWORDS_BLACKLIST = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwertyui",
  "qwertyuiop",
  "admin123",
  "admin1234",
  "letmein1",
  "welcome1",
  "datria123",
  "changeme",
  "iloveyou",
  "secret123",
  "p@ssword",
  "p@ssw0rd",
  "p@ssword1",
  "p@ssw0rd1",
  "senha123",
  "senha1234",
  "master123",
]);

@Injectable()
export class Argon2PasswordHasher {
  private readonly options = ARGON2_OPTIONS;

  validatePasswordPolicy(password: string): void {
    if (!password || typeof password !== "string") {
      throw new ValidationErrorException("Password must be a valid string");
    }

    if (password.length < 8 || password.length > 128) {
      throw new ValidationErrorException(
        "Password must be between 8 and 128 characters in length",
      );
    }

    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9\s]/.test(password);

    if (!hasLowerCase || !hasUpperCase || !hasNumber || !hasSymbol) {
      throw new ValidationErrorException(
        "Password must contain at least one lowercase letter, one uppercase letter, one number, and one symbol",
      );
    }

    const normalized = password.toLowerCase().trim();
    if (COMMON_PASSWORDS_BLACKLIST.has(normalized)) {
      throw new ValidationErrorException(
        "The chosen password is too common or easily compromised. Please choose a stronger password.",
      );
    }
  }

  async hash(password: string): Promise<string> {
    this.validatePasswordPolicy(password);
    return argon2.hash(password, this.options);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, {
      memoryCost: this.options.memoryCost,
      timeCost: this.options.timeCost,
      parallelism: this.options.parallelism,
    });
  }
}
