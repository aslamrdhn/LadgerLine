import { Router, Request, Response } from 'express';
import { UserService } from '../services/userService.ts';
import { container } from '../container.ts';
import { env } from '../env.ts';
import { authRateLimiter, otpRateLimiter } from '../middlewares/rateLimiter.js';
import { logger, securityLogger } from '../logger.js';
import { validateRequest } from '../middlewares/validate.ts';
import { LoginSchema } from './auth.schemas.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../middlewares/auth.ts';

const sanitizeTenant = (tenant: any) => {
  const { ownerPasswordHash, cashierPin, driveClientSecret, driveClientId, storeWifiPass, ...safeTenant } = tenant;
  // Convert any BigInt values to string to avoid serialization errors
  for (const key in safeTenant) {
    if (typeof safeTenant[key] === 'bigint') {
      safeTenant[key] = safeTenant[key].toString();
    }
  }
  return safeTenant;
};

const router = Router();

// Helper to secure route endpoints
// Needs to be added here

// Refresh Token Endpoint
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    const isRevoked = await UserService.isTokenRevoked(refreshToken);
    if (isRevoked) {
      return res.status(401).json({ success: false, message: 'Refresh token is revoked' });
    }

    const decoded = jwt.verify(refreshToken, getJwtSecret()) as any;
    
    // Issue a new token
    const user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId
    };

    const accessToken = UserService.generateToken(user);

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({ success: true,
        token: accessToken, message: 'Token refreshed' });
  } catch (err: any) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// Securely issues tokens via Set-Cookie and persists rotation state
export const issueAuthCookies = async (res: Response, user: { id: string; email: string; role: string; tenantId: string }) => {
  const accessToken = UserService.generateToken(user);
  const refreshToken = UserService.generateRefreshToken(user);
  await UserService.saveRefreshToken(user.id, refreshToken);

  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return accessToken;
};

// 1. CORE USER LOGIN
router.post('/login', authRateLimiter, validateRequest(LoginSchema), async (req: Request, res: Response) => {
  const { email, password, pin } = req.body;
  
  try {
    // Check if superadmin credentials are supplied
    const superadminEmail = env.SUPERADMIN_EMAIL;
    const isSuperadminEmail = email && email.toLowerCase().trim() === superadminEmail.toLowerCase().trim();
    
    if (isSuperadminEmail) {
      const isValidSuperadmin = await UserService.comparePasswords(password, env.SUPERADMIN_PASSWORD);
      if (isValidSuperadmin) {
        logger.info(`[LOGIN SUCCESS] SuperAdmin user logged in: ${email}`);
        const superUser = { id: 'superadmin', email: superadminEmail, role: 'SUPER_ADMIN', tenantId: 'system' };
        const token = await issueAuthCookies(res, superUser);
        return res.json({
          success: true,
        token,
          user: superUser,
          tenant: {
            id: 'system',
            name: 'LedgerLine Internal System',
            email: superadminEmail,
            status: 'verified',
            role: 'SUPER_ADMIN'
          }
        });
      }
    }

    // Try finding tenant
    if (!email) {
      return res.status(400).json({ success: false, message: 'Alamat email wajib diisi.' });
    }

    const matchedTenant = await container.systemRepository.findTenantByEmail(email);
    
    if (!matchedTenant) {
      securityLogger.warn(`[LOGIN FAILURE] Unknown user email attempted: ${email}`);
      return res.status(401).json({ success: false, message: 'Alamat email tidak terdaftar.' });
    }
    
    if ((matchedTenant as any).accountStatus === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Akun Tenant Anda ditangguhkan oleh Administrator.' });
    }

    // Handle cashier PIN login if pin is provided
    if (pin !== undefined && pin !== '') {
      const storedPin = (matchedTenant as any).cashierPin || '';
      let isValidPin = false;

      if (storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$') || storedPin.startsWith('$2y$')) {
        isValidPin = await UserService.comparePasswords(pin, storedPin);
      } else {
        isValidPin = storedPin === pin;
        if (isValidPin) {
          logger.info(`[PIN MIGRATION] Upgrading legacy PIN to bcrypt hash for user: ${email}`);
          (matchedTenant as any).cashierPin = await UserService.hashPassword(pin);
          await container.tenantRepository.saveTenant(matchedTenant.id, matchedTenant);
        }
      }

      if (!isValidPin) {
        securityLogger.warn(`[LOGIN FAILURE] Incorrect PIN for user: ${email}`);
        return res.status(401).json({ success: false, message: 'PIN kasir yang Anda masukkan salah.' });
      }

      logger.info(`[LOGIN SUCCESS] Tenant cashier logged in via PIN: ${email} (Tenant: ${matchedTenant.id})`);
      
      // Update tenant active position in Database to Kasir
      (matchedTenant as any).activeOperatorRole = 'Kasir';
      await container.tenantRepository.saveTenant(matchedTenant.id, matchedTenant);

      const userKasir = {
        id: matchedTenant.id,
        email: (matchedTenant as any).cashierEmail || (matchedTenant as any).ownerEmail || matchedTenant.name,
        role: 'Kasir',
        tenantId: matchedTenant.id
      };
      const token = await issueAuthCookies(res, userKasir);
      
      try {
         await container.systemRepository.createSecurityAuditLog(matchedTenant.id, {
            action: 'LOGIN',
            operator: userKasir.email,
            details: `User ${userKasir.email} logged in as Kasir from IP ${req.ip}`,
            severity: 'info'
         });
      } catch (e) {
         securityLogger.error(`Failed to write login audit log`);
      }

      return res.json({
        success: true,
        token,
        user: { ...userKasir, storeName: (matchedTenant as any).storeName || matchedTenant.name },
        tenant: {
          ...sanitizeTenant(matchedTenant),
          activeOperatorRole: 'Kasir'
        }
      });
    }

    // Handle password login
    if (!password) {
      return res.status(400).json({ success: false, message: 'Kata sandi wajib diisi.' });
    }

    const storedHash = (matchedTenant as any).ownerPasswordHash || '';
    if (!storedHash) {
      return res.status(401).json({ success: false, message: 'Akun ini belum memiliki password terdaftar. Hubungi admin.' });
    }
    
    // Check if password matches using strictly bcrypt
    let isValidPassword = await UserService.comparePasswords(password, storedHash);

    if (!isValidPassword) {
      securityLogger.warn(`[LOGIN FAILURE] Incorrect password for user: ${email}`);
      return res.status(401).json({ success: false, message: 'Alamat email atau password salah.' });
    }

    // Force active position to Owner in database
    (matchedTenant as any).activeOperatorRole = 'Owner';
    await container.tenantRepository.saveTenant(matchedTenant.id, matchedTenant);

    logger.info(`[LOGIN SUCCESS] Tenant owner logged in successfully: ${email} (Tenant: ${matchedTenant.id})`);
    
    const userOwner = {
      id: matchedTenant.id,
      email: (matchedTenant as any).cashierEmail || (matchedTenant as any).ownerEmail || (matchedTenant as any).email || '',
      role: 'Owner', // Always 'Owner' when matching owner password!
      tenantId: matchedTenant.id
    };
    const token = await issueAuthCookies(res, userOwner);
    
    try {
       await container.systemRepository.createSecurityAuditLog(matchedTenant.id, {
          action: 'LOGIN',
          operator: userOwner.email,
          details: `User ${userOwner.email} logged in as Owner from IP ${req.ip}`,
          severity: 'info'
       });
    } catch (e) {
       securityLogger.error(`Failed to write login audit log`);
    }

    res.json({
      success: true,
        token,
      user: { ...userOwner, storeName: (matchedTenant as any).storeName || matchedTenant.name },
      tenant: {
        ...sanitizeTenant(matchedTenant),
        activeOperatorRole: 'Owner'
      }
    });

  } catch (err: any) {
    logger.error(`[LOGIN ERROR] Exception thrown: ${err.message}`);
    res.status(500).json({ success: false, message: 'Kesalahan internal saat login. Hubungi Admin.' });
  }
});

// 2. DEMO LOGIN ENDPOINT
router.post('/demo-login', authRateLimiter, async (req: Request, res: Response) => {
  if (env.NODE_ENV === 'production' && process.env.ENABLE_DEMO_LOGIN !== 'true') {
    return res.status(403).json({ success: false, message: 'Demo mode is disabled in production.' });
  }

  try {
    const defaultTenantId = 'aslam-brew';
    let tenant = await container.tenantRepository.getTenant(defaultTenantId);
    
    if (!tenant) {
      // Seed tenant lazily
      tenant = await container.tenantRepository.saveTenant(defaultTenantId, {
        storeName: 'Ledger Line by Aslam',
        ownerEmail: process.env.DEFAULT_OWNER_EMAIL || 'admin@ledgerline.local',
        cashierEmail: process.env.DEFAULT_OWNER_EMAIL || 'admin@ledgerline.local',
        ownerPasswordHash: await bcrypt.hash(env.DEFAULT_OWNER_PASSWORD, 10),
        activeOperatorRole: 'Owner'
      });
    } else {
      // Enforce Owner state on login
      (tenant as any).activeOperatorRole = 'Owner';
      await container.tenantRepository.saveTenant(tenant.id, tenant);
    }

    logger.info('[LOGIN SUCCESS] Active Demo tenant environment launched.');
    const userDemo = {
      id: tenant.id,
      email: (tenant as any).ownerEmail || (tenant as any).cashierEmail || (tenant as any).email || '',
      role: 'Owner',
      tenantId: tenant.id
    };
    const token = await issueAuthCookies(res, userDemo);

    res.json({
      success: true,
        token,
      user: { ...userDemo, storeName: (tenant as any).storeName || tenant.name },
      tenant: {
        ...sanitizeTenant(tenant),
        activeOperatorRole: 'Owner'
      },
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. SECURE CORE LOGOUT
router.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await UserService.removeRefreshToken(refreshToken);
  }
  res.clearCookie('token');
  res.clearCookie('refreshToken');
  res.clearCookie('csrf-token'); // Optional safety
  res.json({ success: true,
        message: 'Berhasil logout dari sistem POS.' });
});


// 4. GOOGLE AUTH (LOGIN & REGISTER)
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'pro-cumulus-xmvz5' });
}

import { getPrismaClient } from '../db.js';

router.post('/google-auth', async (req, res) => {
  const { idToken, action, storeName, storePhone, storeAddress, cashierName, pin, role } = req.body;
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const email = decodedToken.email;

    if (!email) return res.status(400).json({ success: false, message: 'Gagal mendapatkan email dari akun Google Anda.' });

    const prisma = getPrismaClient() as any;

    if (action === 'register') {
      let tenant = await container.systemRepository.findTenantByEmail(email);
      if (tenant) {
        return res.status(400).json({ success: false, message: 'Akun Google ini sudah terdaftar sebagai pemilik toko. Silakan login.' });
      }

      if (!storeName) {
        return res.status(400).json({ success: false, message: 'Nama toko wajib diisi.' });
      }

      const finalTenantId = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const existingTenant = await prisma.tenant.findUnique({ where: { slug: finalTenantId } });
      if (existingTenant) {
        return res.status(400).json({ success: false, message: 'Nama toko tersebut sudah digunakan oleh kedai lain.' });
      }

      const hashedPin = await UserService.hashPassword(pin || '1234');
      const hashedPassword = await UserService.hashPassword(Math.random().toString(36).slice(-8));

      // Create everything via Prisma transaction if possible, or sequential
      const newTenant = await prisma.tenant.create({
        data: {
          id: finalTenantId,
          name: storeName,
          slug: finalTenantId,
          email: email
        }
      });
      
      await prisma.tenantSetting.create({
        data: { tenantId: newTenant.id }
      });
      
      const outlet = await prisma.outlet.create({
        data: {
          tenantId: newTenant.id,
          name: storeName,
          address: storeAddress || 'Jl. Raya Lokal Cafe, Indonesia',
          phone: storePhone || '-',
          isDefault: true
        }
      });
      
      await prisma.warehouse.create({
        data: {
          tenantId: newTenant.id,
          outletId: outlet.id,
          name: 'Main Storage',
          isDefault: true
        }
      });

      const ownerUserObj = await prisma.user.create({
        data: {
          tenantId: newTenant.id,
          email: email,
          name: 'Owner',
          role: 'OWNER',
          passwordHash: hashedPassword
        }
      });
      
      await prisma.user.create({
        data: {
          tenantId: newTenant.id,
          email: `cashier@${finalTenantId}.local`,
          name: cashierName || 'Barista',
          role: 'CASHIER',
          passwordHash: hashedPin
        }
      });

      await container.systemRepository.createSecurityAuditLog(newTenant.id, {
        action: 'TENANT_REGISTER_GOOGLE',
        operator: email,
        details: `New Tenant registered via Google: ${storeName}`,
        severity: 'info'
      });

      const userOwner = {
        id: ownerUserObj.id,
        email: email,
        role: 'OWNER',
        tenantId: newTenant.id
      };
      const token = await issueAuthCookies(res, userOwner);

      return res.json({
        success: true,
        token,
        tenantId: newTenant.id,
        user: { ...userOwner, storeName: newTenant.name },
        tenant: { ...newTenant, activeOperatorRole: 'Owner' },
        message: 'Toko berhasil didaftarkan.'
      });
    } else if (action === 'login') {
      const tenant = await container.systemRepository.findTenantByEmail(email);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Toko belum terdaftar. Silakan daftar toko baru menggunakan akun Google ini.' });
      }

      if (tenant.status === 'SUSPENDED') {
        return res.status(403).json({ success: false, message: 'Akun Anda ditangguhkan oleh Administrator.' });
      }

      if (role === 'Cashier') {
        if (!pin) return res.status(400).json({ success: false, message: 'PIN Kasir diperlukan untuk masuk sebagai kasir.' });
        
        const cashierUser = await prisma.user.findFirst({
          where: { tenantId: tenant.id, role: 'CASHIER' }
        });
        
        if (!cashierUser) {
           return res.status(401).json({ success: false, message: 'Tidak ada akun kasir di toko ini.' });
        }

        const storedPin = cashierUser.passwordHash || '';
        let isValidPin = false;
        if (storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$') || storedPin.startsWith('$2y$')) {
          isValidPin = await UserService.comparePasswords(pin, storedPin);
        } else {
          isValidPin = storedPin === pin;
        }

        if (!isValidPin) {
          return res.status(401).json({ success: false, message: 'PIN Kasir salah.' });
        }

        const userKasir = { id: cashierUser.id, email: cashierUser.email, role: 'CASHIER', tenantId: tenant.id };
        const token = await issueAuthCookies(res, userKasir);

        return res.json({
          success: true,
          token,
          user: { ...userKasir, storeName: tenant.name },
          tenant: { ...tenant, activeOperatorRole: 'Kasir' }
        });
      } else {
        const ownerUser = await prisma.user.findFirst({
           where: { tenantId: tenant.id, role: 'OWNER' }
        });
        
        const ownerEmail = ownerUser ? ownerUser.email : email;
        const ownerId = ownerUser ? ownerUser.id : tenant.id;

        const userOwner = { id: ownerId, email: ownerEmail, role: 'OWNER', tenantId: tenant.id };
        const token = await issueAuthCookies(res, userOwner);

        return res.json({
          success: true,
          token,
          user: { ...userOwner, storeName: tenant.name },
          tenant: { ...tenant, activeOperatorRole: 'Owner' }
        });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error: any) {
    logger.error(`[GoogleAuth] Error: ${error.message}`, error.stack);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan internal pada server.', error: error.message });
  }
});

export const authRouter = router;
export default authRouter;
