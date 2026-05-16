import { ConfigService } from '@nestjs/config';
import { CredentialVaultService } from './credential-vault.service';

describe('CredentialVaultService', () => {
  const config = {
    get: (key: string) =>
      key === 'openFinance.encryptionKey' ? 'test-vault-key-for-unit-tests-only' : undefined,
  } as ConfigService;

  const vault = new CredentialVaultService(config);

  it('round-trips plaintext', () => {
    const encrypted = vault.encrypt('secret-access-token');
    const plain = vault.decrypt(encrypted);
    expect(plain).toBe('secret-access-token');
  });

  it('encrypts token pairs for storage', () => {
    const stored = vault.encryptTokens({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(stored.accessCipher).toBeTruthy();
    expect(stored.accessIv).toBeTruthy();
    expect(stored.refreshCipher).toBeTruthy();
    const access = vault.decryptAccessToken(stored.accessCipher, stored.accessIv, stored.keyVersion);
    expect(access).toBe('access-1');
  });
});
