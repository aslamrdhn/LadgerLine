import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.ts';
import { generateToken } from '../utils/jwt.ts';
import { getFirebaseAdmin } from '../lib/firebase-admin.ts';
import { getAuth } from 'firebase-admin/auth';

export class AuthService {
  /**
   * Cashier / Kitchen PIN Login
   */
  static async loginWithPin(userId: string, pin: string, deviceId?: string) {
    const user = await prisma.userProfile.findUnique({
      where: { userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.status !== 'active') {
      throw new Error('User is inactive');
    }

    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      throw new Error('Account locked due to too many failed attempts. Contact supervisor.');
    }

    if (!user.pinHash) {
      throw new Error('PIN not set up for this user');
    }

    const isValid = await bcrypt.compare(pin, user.pinHash);

    if (!isValid) {
      const attempts = user.pinAttempts + 1;
      let lockedUntil = null;

      if (attempts >= 3) {
        // Lock for 15 minutes
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await prisma.userProfile.update({
        where: { id: user.id },
        data: { 
          pinAttempts: attempts,
          pinLockedUntil: lockedUntil
        }
      });

      if (lockedUntil) {
        throw new Error('PIN incorrect 3 times. Account locked for 15 minutes.');
      }
      throw new Error('Invalid PIN');
    }

    // Success login
    await prisma.userProfile.update({
      where: { id: user.id },
      data: {
        pinAttempts: 0,
        pinLockedUntil: null,
        lastLoginAt: new Date(),
        deviceId: deviceId || user.deviceId
      }
    });

    const token = generateToken({
      userId: user.userId,
      tenantId: user.tenantId || undefined
    });

    return { token, role: user.role };
  }

  /**
   * Google Authentication Logic (Login/Register)
   */
  static async googleAuth(payload: any) {
    const { idToken, action, role, pin, storeName, storePhone, storeAddress, cashierName } = payload;
    
    // 1. Verify Firebase ID Token
    const adminApp = getFirebaseAdmin();
    const decodedToken = await getAuth(adminApp).verifyIdToken(idToken);
    
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name || email;

    if (action === 'register') {
      const existingUser = await prisma.userProfile.findUnique({ where: { userId: uid } });
      if (existingUser) {
        throw new Error('Account already registered. Please login.');
      }

      const storeSlug = (storeName || 'toko-baru').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);

      const tenant = await prisma.tenant.create({
        data: {
          name: storeName || 'Toko Baru',
          slug: storeSlug,
          status: 'active',
          outlets: {
            create: {
              name: 'Outlet Utama',
              address: storeAddress,
              phone: storePhone
            }
          }
        },
        include: { outlets: true }
      });

      const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

      const user = await prisma.userProfile.create({
        data: {
          userId: uid,
          tenantId: tenant.id,
          role: 'owner',
          fullName: name,
          pinHash,
          assignedOutlets: JSON.stringify([tenant.outlets[0].id])
        }
      });

      const token = generateToken({
        userId: user.userId,
        tenantId: user.tenantId || undefined
      });

      return { token, tenant, user };
    } else {
      // Login
      const user = await prisma.userProfile.findUnique({
        where: { userId: uid },
        include: { tenant: true }
      });

      if (!user) {
        throw new Error('Account not found. Please register first.');
      }

      if (user.status !== 'active') {
        throw new Error('Account is inactive.');
      }

      // If logging in as Cashier, verify PIN
      if (role === 'Cashier') {
        if (!user.pinHash) {
          throw new Error('PIN not set up for this user');
        }
        if (!pin) {
           throw new Error('PIN is required for Cashier login');
        }
        const isValid = await bcrypt.compare(pin, user.pinHash);
        if (!isValid) {
          throw new Error('Invalid PIN');
        }
      }

      const token = generateToken({
        userId: user.userId,
        tenantId: user.tenantId || undefined
      });

      return { token, tenant: user.tenant, user };
    }
  }
}
