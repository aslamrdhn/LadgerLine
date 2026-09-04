import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { logger, securityLogger } from '../../logger.js';
import { sendBrevoEmail } from '../../notification.ts';
import { env } from '../../env.js';
import bcrypt from 'bcryptjs';

export class AuthController {
  constructor(
    private authService: AuthService,
    private authRepository: AuthRepository
  ) {}

  private setAuthCookie(res: Response, token: string) {
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }

  login = async (req: Request, res: Response) => {
    const { email, password, pin } = req.body;
    
    try {
      const superadminEmail = process.env.SUPERADMIN_EMAIL || 'admin@ledgerline.cloud';
      const isSuperadminEmail = email && email.toLowerCase().trim() === superadminEmail.toLowerCase().trim();
      
      if (isSuperadminEmail && password) {
        const superadminPassword = process.env.SUPERADMIN_PASSWORD;
        if (!superadminPassword) {
          logger.error(`[SUPERADMIN] Cannot authenticate: SUPERADMIN_PASSWORD not set in environment.`);
          return res.status(500).json({ success: false, message: 'Autentikasi superadmin tidak dikonfigurasi dengan aman.' });
        }
        
        const isMatch = password === superadminPassword || await bcrypt.compare(password, await bcrypt.hash(superadminPassword, 10));
  
        if (isMatch) {
          logger.info(`[LOGIN SUCCESS] SuperAdmin user logged in: ${email}`);
          const token = this.authService.generateToken({
            id: 'superadmin',
            email: superadminEmail,
            role: 'superadmin',
            tenantId: 'system'
          });
          this.setAuthCookie(res, token);
          return res.json({
            success: true,
            token,
            user: { id: 'superadmin', email: superadminEmail, role: 'superadmin', tenantId: 'system' },
            tenant: {
              id: 'system',
              storeName: 'LedgerLine System Administration',
              activeOperatorRole: 'superadmin'
            }
          });
        }
      }
  
      if (!email) {
        return res.status(400).json({ success: false, message: 'Alamat email wajib diisi.' });
      }
  
      const matchedTenant = await this.authRepository.findTenantByEmail(email);
      
      if (!matchedTenant) {
        securityLogger.warn(`[LOGIN FAILURE] Unknown user email attempted: ${email}`);
        return res.status(401).json({ success: false, message: 'Alamat email tidak terdaftar.' });
      }
  
      if (pin !== undefined && pin !== '') {
        const isValidPin = matchedTenant.cashierPin === pin;
        if (!isValidPin) {
          securityLogger.warn(`[LOGIN FAILURE] Incorrect PIN for user: ${email}`);
          return res.status(401).json({ success: false, message: 'PIN kasir yang Anda masukkan salah.' });
        }
  
        logger.info(`[LOGIN SUCCESS] Tenant cashier logged in via PIN: ${email} (Tenant: ${matchedTenant.id})`);
        
        await this.authRepository.updateTenantRole(matchedTenant.id, 'Kasir');
        matchedTenant.activeOperatorRole = 'Kasir';
  
        const token = this.authService.generateToken({
          id: matchedTenant.id,
          email: matchedTenant.cashierEmail || matchedTenant.ownerEmail,
          role: 'Kasir',
          tenantId: matchedTenant.id
        });
  
        this.setAuthCookie(res, token);
  
        return res.json({
          success: true,
          token,
          user: {
            id: matchedTenant.id,
            email: matchedTenant.cashierEmail || matchedTenant.ownerEmail,
            role: 'Kasir',
            tenantId: matchedTenant.id,
            storeName: matchedTenant.storeName
          },
          tenant: matchedTenant
        });
      }
  
      if (!password) {
        return res.status(400).json({ success: false, message: 'Kata sandi wajib diisi.' });
      }
  
      const storedHash = matchedTenant.ownerPasswordHash || '';
      if (!storedHash) {
        return res.status(401).json({ success: false, message: 'Akun ini belum memiliki password terdaftar. Hubungi admin.' });
      }
      
      let isValidPassword = false;
  
      if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
        isValidPassword = await this.authService.comparePasswords(password, storedHash);
      } else {
        isValidPassword = storedHash === password || storedHash === ('SECURE_HASHED_PASS_' + password);
        if (isValidPassword) {
          logger.info(`[PASSWORD MIGRATION] Upgrading legacy password to bcrypt hash for user: ${email}`);
          matchedTenant.ownerPasswordHash = await this.authService.hashPassword(password);
          await this.authRepository.updateTenantPassword(matchedTenant.id, matchedTenant.ownerPasswordHash);
        }
      }
  
      if (!isValidPassword) {
        securityLogger.warn(`[LOGIN FAILURE] Incorrect password for user: ${email}`);
        return res.status(401).json({ success: false, message: 'Alamat email atau password salah.' });
      }
  
      await this.authRepository.updateTenantRole(matchedTenant.id, 'Owner');
      matchedTenant.activeOperatorRole = 'Owner';
  
      logger.info(`[LOGIN SUCCESS] Tenant owner logged in successfully: ${email} (Tenant: ${matchedTenant.id})`);
      
      const token = this.authService.generateToken({
        id: matchedTenant.id,
        email: matchedTenant.cashierEmail || matchedTenant.ownerEmail,
        role: 'Owner',
        tenantId: matchedTenant.id
      });
  
      this.setAuthCookie(res, token);
  
      return res.json({
        success: true,
        token,
        user: {
          id: matchedTenant.id,
          email: matchedTenant.cashierEmail || matchedTenant.ownerEmail,
          role: 'Owner',
          tenantId: matchedTenant.id,
          storeName: matchedTenant.storeName
        },
        tenant: matchedTenant
      });
  
    } catch (err: any) {
      logger.error(`[LOGIN ERROR] Exception thrown:`, err);
      res.status(500).json({ success: false, message: 'Kesalahan internal saat login. Hubungi Admin.' });
    }
  }

  logout = (req: Request, res: Response) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Berhasil logout dari sistem POS.' });
  }

  sendOtp = async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email penerima wajib diisi.' });
    }
  
    try {
      const calculatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await this.authService.saveOtp(email, calculatedOtp);
      logger.info(`[OTP PORTAL] Securing registration OTP token [${calculatedOtp}] for ${email}`);
      
      const subject = 'LedgerLine POS - Kode Otentikasi Registrasi Anda';
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #4f46e5; text-align: center;">Konfigurasi Multi-Tenant LedgerLine</h2>
          <p>Halo,</p>
          <p>Anda menerima email ini karena email Anda digunakan untuk mendaftarkan merchant/toko baru di platform <b>LedgerLine POS</b>.</p>
          <div style="text-align: center; margin: 30px 0; padding: 15px; background-color: #f1f5f9; border-radius: 6px;">
            <small style="color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 5px;">Kode OTP Registrasi</small>
            <span style="font-size: 32px; font-weight: bold; color: #1e293b; letter-spacing: 5px;">${calculatedOtp}</span>
          </div>
          <p style="color: #475569; font-size: 14px;">Masukkan kode verifikasi di atas pada form pendaftaran Anda. Kode ini berlaku selama <b>5 menit</b>.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <small style="color: #94a3b8; display: block; text-align: center;">Jika Anda tidak merasa melakukan tindakan ini, Anda dapat mengabaikan email ini secara aman.</small>
        </div>
      `;
      await sendBrevoEmail(email, subject, htmlBody);
  
      res.json({
        success: true,
        message: 'Kode OTP pendaftaran berhasil dikirim ke alamat email Anda.',
        otpDebug: env.NODE_ENV === 'development' ? calculatedOtp : undefined 
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Masukkan email akun pemilik.' });
    }
  
    try {
      const tenant = await this.authRepository.findTenantByEmail(email);
      
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Akun email tersebut tidak terdaftar di sistem.' });
      }
  
      const calculatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await this.authService.saveOtp(email, calculatedOtp);
      logger.info(`[RESET OTP] Generates password reset OTP for ${email}`);
  
      const subject = 'LedgerLine POS - Kode Pemulihan Kata Sandi';
      const htmlBody = `<h2>Pemulihan Akun LedgerLine</h2><p>OTP: ${calculatedOtp}</p>`;
      await sendBrevoEmail(email, subject, htmlBody);
  
      res.json({
        success: true,
        message: 'Kode OTP pemulihan kata sandi berhasil dikirim ke email Anda.',
        otpDebug: env.NODE_ENV === 'development' ? calculatedOtp : undefined
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  resetPassword = async (req: Request, res: Response) => {
    const { email, otp, code, newPassword, newPin } = req.body;
    const finalOtp = otp || code;
  
    if (!email || !finalOtp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Harap lengkapi email, OTP, dan sandi baru.' });
    }
  
    try {
      const isOtpValid = await this.authService.verifyOtp(email, finalOtp);
      if (!isOtpValid) {
        return res.status(400).json({ success: false, message: 'Kode OTP tidak valid atau kedaluwarsa.' });
      }
  
      const tenant = await this.authRepository.findTenantByEmail(email);
      
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant pemilik email tidak ditemukan.' });
      }
  
      const hashedP = await this.authService.hashPassword(newPassword);
      await this.authRepository.updateTenantPassword(tenant.id, hashedP, newPin);
  
      logger.info(`[PASSWORD RESET] Successfully updated credentials for: ${email}`);
      res.json({ success: true, message: 'Kata sandi berhasil diperbarui.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
