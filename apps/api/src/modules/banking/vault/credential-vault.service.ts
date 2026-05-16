import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

export type TokenPair = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  keyVersion: number;
};

@Injectable()
export class CredentialVaultService {
  private readonly keyVersion = 1;

  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): EncryptedPayload {
    const key = this.deriveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, tag]);
    return {
      ciphertext: combined.toString('base64'),
      iv: iv.toString('base64'),
      keyVersion: this.keyVersion,
    };
  }

  decrypt(payload: EncryptedPayload): string {
    if (payload.keyVersion !== this.keyVersion) {
      throw new InternalServerErrorException('Versão de chave de criptografia não suportada.');
    }
    const key = this.deriveKey();
    const iv = Buffer.from(payload.iv, 'base64');
    const combined = Buffer.from(payload.ciphertext, 'base64');
    const tag = combined.subarray(combined.length - 16);
    const data = combined.subarray(0, combined.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  encryptTokens(tokens: TokenPair): {
    accessCipher: string;
    accessIv: string;
    refreshCipher?: string;
    refreshIv?: string;
    keyVersion: number;
    expiresAt?: Date;
  } {
    const access = this.encrypt(tokens.accessToken);
    let refreshCipher: string | undefined;
    let refreshIv: string | undefined;
    if (tokens.refreshToken) {
      const refresh = this.encrypt(tokens.refreshToken);
      refreshCipher = refresh.ciphertext;
      refreshIv = refresh.iv;
    }
    return {
      accessCipher: access.ciphertext,
      accessIv: access.iv,
      refreshCipher,
      refreshIv,
      keyVersion: access.keyVersion,
      expiresAt: tokens.expiresAt,
    };
  }

  decryptAccessToken(accessCipher: string, accessIv: string, keyVersion: number): string {
    return this.decrypt({ ciphertext: accessCipher, iv: accessIv, keyVersion });
  }

  private deriveKey(): Buffer {
    const secret =
      this.config.get<string>('openFinance.encryptionKey') ??
      process.env.ENCRYPTION_KEY ??
      'dev-encryption-key-change-in-production-32';
    return scryptSync(secret, 'navomnis-banking-vault', 32);
  }
}
