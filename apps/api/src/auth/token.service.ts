import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { CONFIG, type AppConfig } from '../config/config.module.js';

const ISSUER = 'kotgambit';
const REFRESH_TOKEN_BYTES = 32;

@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.secret = new TextEncoder().encode(config.jwtAccessSecret);
  }

  signAccessToken(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTokenTtlSeconds}s`)
      .sign(this.secret);
  }

  /** The user id from a valid access token, or null for anything else (expired, forged, malformed). */
  async verifyAccessToken(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: ISSUER,
        algorithms: ['HS256'],
      });
      return payload.sub ?? null;
    } catch {
      // Every verification failure means the same to the caller: not authenticated
      return null;
    }
  }

  /** A random one-time secret: refresh tokens and the links in emails are made the same way. */
  generateOpaqueToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  /** Only the hash is stored, so a leaked table does not hand out working sessions or links. */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
