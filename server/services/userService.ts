import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../middlewares/auth.ts';

export class UserService {
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }
  static async comparePasswords(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
  static generateToken(user: any): string {
    return jwt.sign(user, getJwtSecret(), { expiresIn: '15m' });
  }
  static generateRefreshToken(user: any): string {
    return jwt.sign(user, getJwtSecret(), { expiresIn: '7d' });
  }
  static async saveRefreshToken(userId: string, token: string): Promise<void> {}
  static async removeRefreshToken(token: string): Promise<void> {}
  static async isTokenRevoked(token: string): Promise<boolean> { return false; }
  static async saveOtp(email: string, otp: string): Promise<void> {}
  static async verifyOtp(email: string, otp: string): Promise<boolean> { return true; }
}
