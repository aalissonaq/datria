import { Argon2PasswordHasher } from "./argon2-password-hasher";
import * as argon2 from "argon2";

describe("Argon2PasswordHasher", () => {
  let hasher: Argon2PasswordHasher;

  beforeEach(() => {
    hasher = new Argon2PasswordHasher();
  });

  describe("validatePasswordPolicy", () => {
    it("rejects passwords shorter than 8 characters", () => {
      expect(() => hasher.validatePasswordPolicy("Ab1!xyz")).toThrow(
        /between 8 and 128 characters/,
      );
    });

    it("rejects passwords longer than 128 characters", () => {
      const longPassword = "A1!" + "a".repeat(130);
      expect(() => hasher.validatePasswordPolicy(longPassword)).toThrow(
        /between 8 and 128 characters/,
      );
    });

    it("rejects passwords missing a lowercase letter", () => {
      expect(() => hasher.validatePasswordPolicy("ABCDEF123!@#")).toThrow(
        /at least one lowercase letter/,
      );
    });

    it("rejects passwords missing an uppercase letter", () => {
      expect(() => hasher.validatePasswordPolicy("abcdef123!@#")).toThrow(
        /at least one lowercase letter/,
      );
    });

    it("rejects passwords missing a number", () => {
      expect(() => hasher.validatePasswordPolicy("Abcdefgh!@#$")).toThrow(
        /at least one lowercase letter/,
      );
    });

    it("rejects passwords missing a symbol", () => {
      expect(() => hasher.validatePasswordPolicy("Abcdefgh1234")).toThrow(
        /at least one lowercase letter/,
      );
    });

    it("rejects common compromised passwords from blacklist", () => {
      expect(() => hasher.validatePasswordPolicy("P@ssw0rd1")).toThrow(
        /too common or easily compromised/,
      );
    });

    it("accepts strong compliant passwords with unicode and spaces", () => {
      expect(() =>
        hasher.validatePasswordPolicy("SegredoForte!99 com espaco"),
      ).not.toThrow();
    });
  });

  describe("hash and verify", () => {
    it("hashes using Argon2id with memoryCost=19456, timeCost=2, parallelism=1", async () => {
      const password = "ValidStrongPassword#2026";
      const hash = await hasher.hash(password);

      expect(hash).toMatch(/^\$argon2id\$v=19\$/);
      expect(hash).toContain("m=19456");
      expect(hash).toContain("t=2");
      expect(hash).toContain("p=1");

      const isValid = await hasher.verify(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await hasher.verify("WrongPassword!123", hash);
      expect(isInvalid).toBe(false);
    });

    it("detects needsRehash when cost differs", async () => {
      const password = "ValidStrongPassword#2026";
      const oldHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 1024,
        timeCost: 1,
        parallelism: 1,
      });

      expect(hasher.needsRehash(oldHash)).toBe(true);
      const currentHash = await hasher.hash(password);
      expect(hasher.needsRehash(currentHash)).toBe(false);
    });
  });
});
