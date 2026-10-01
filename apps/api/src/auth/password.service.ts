import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

@Injectable()
export class PasswordService {
  // Verified against this when the account does not exist, so that "unknown email" and
  // "wrong password" take the same time and cannot be told apart from the outside
  private readonly decoyHash = argon2.hash('decoy-password');

  hash(password: string): Promise<string> {
    // argon2id with the library defaults
    return argon2.hash(password);
  }

  async verify(hash: string | null, password: string): Promise<boolean> {
    if (hash === null) {
      await argon2.verify(await this.decoyHash, password);
      return false;
    }
    return argon2.verify(hash, password);
  }
}
