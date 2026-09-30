import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PassVerificationTokenResponse } from '@chainpass/schemas';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { prisma } from '../database/prisma.js';

export const QR_VERIFICATION_TOKEN_TTL_SECONDS = 60;
export const QR_TOKEN_CLOCK = Symbol('QR_TOKEN_CLOCK');

interface QrTokenPayload {
  v: 1;
  passId: string;
  ownerId: string;
  nonce: string;
  iat: number;
  exp: number;
}

@Injectable()
export class QrVerificationTokenService {
  constructor(@Inject(QR_TOKEN_CLOCK) private readonly now: () => number) {}

  async create(
    passId: string,
    ownerId: string,
  ): Promise<PassVerificationTokenResponse> {
    const pass = await prisma.pass.findUnique({
      where: { id: passId },
      select: { id: true, ownerId: true, status: true },
    });

    if (!pass) {
      throw new NotFoundException({
        code: 'PASS_NOT_FOUND',
        message: 'Pass not found',
      });
    }

    if (pass.ownerId !== ownerId) {
      throw new ForbiddenException({
        code: 'PASS_NOT_OWNED',
        message: 'You can only create a QR code for your own pass',
      });
    }

    if (pass.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'PASS_NOT_ACTIVE',
        message: 'Only an active pass can create a verification token',
      });
    }

    const issuedAt = Math.floor(this.now() / 1_000);
    const payload: QrTokenPayload = {
      v: 1,
      passId: pass.id,
      ownerId: pass.ownerId,
      nonce: randomUUID(),
      iat: issuedAt,
      exp: issuedAt + QR_VERIFICATION_TOKEN_TTL_SECONDS,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );

    return {
      token: `${encodedPayload}.${this.sign(encodedPayload)}`,
      expiresAt: new Date(payload.exp * 1_000).toISOString(),
    };
  }

  async resolve(token: string): Promise<string> {
    const [encodedPayload, signature, extra] = token.split('.');
    if (!encodedPayload || !signature || extra) throw this.invalidToken();

    const expectedSignature = this.sign(encodedPayload);
    const actualBytes = Buffer.from(signature, 'base64url');
    const expectedBytes = Buffer.from(expectedSignature, 'base64url');
    if (
      actualBytes.length !== expectedBytes.length ||
      !timingSafeEqual(actualBytes, expectedBytes)
    ) {
      throw this.invalidToken();
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
    } catch {
      throw this.invalidToken();
    }

    if (!this.isPayload(payload)) throw this.invalidToken();

    if (Math.floor(this.now() / 1_000) >= payload.exp) {
      throw new BadRequestException({
        code: 'QR_TOKEN_EXPIRED',
        message: 'QR verification token has expired',
      });
    }

    const pass = await prisma.pass.findUnique({
      where: { id: payload.passId },
      select: { ownerId: true },
    });
    if (!pass) {
      throw new NotFoundException({
        code: 'PASS_NOT_FOUND',
        message: 'Pass not found',
      });
    }

    if (pass.ownerId !== payload.ownerId) throw this.invalidToken();

    return payload.passId;
  }

  private sign(encodedPayload: string): string {
    const secret = process.env.QR_VERIFICATION_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new ServiceUnavailableException({
        code: 'QR_VERIFICATION_NOT_CONFIGURED',
        message: 'QR verification is not configured',
      });
    }

    return createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');
  }

  private isPayload(value: unknown): value is QrTokenPayload {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;

    return (
      payload.v === 1 &&
      typeof payload.passId === 'string' &&
      payload.passId.length > 0 &&
      typeof payload.ownerId === 'string' &&
      payload.ownerId.length > 0 &&
      typeof payload.nonce === 'string' &&
      payload.nonce.length > 0 &&
      Number.isSafeInteger(payload.iat) &&
      Number.isSafeInteger(payload.exp) &&
      (payload.exp as number) > (payload.iat as number)
    );
  }

  private invalidToken(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_QR_TOKEN',
      message: 'QR verification token is invalid',
    });
  }
}
