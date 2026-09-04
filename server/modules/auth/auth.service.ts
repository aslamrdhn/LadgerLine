import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { AuthRepository } from './auth.repository.js';

export class AuthService {
  private otpStore = new Map<string, { code: string, expiresAt: number }>();

  constructor(private authRepository: AuthRepository) {}

  generateToken(payload: object): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' });
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async comparePasswords(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async saveOtp(email: string, code: string): Promise<void> {
    // 5 minutes expiry
    this.otpStore.set(email.toLowerCase(), {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000
    });
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const record = this.otpStore.get(email.toLowerCase());
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.otpStore.delete(email.toLowerCase());
      return false;
    }
    if (record.code === code) {
      this.otpStore.delete(email.toLowerCase());
      return true;
    }
    return false;
  }
}
