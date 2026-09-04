import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger, securityLogger } from '../logger.js';

import { env } from '../env.ts';

// Get secure JWT Secret from environment variables
export const getJwtSecret = (): string => {
  return env.JWT_SECRET;
};

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'SuperAdmin' | 'Owner' | 'Manager' | 'Cashier' | 'Supplier' | string;
    tenantId?: string;
    supplierId?: string;
  };
}

// 1. SECURITY HEADERS MIDDLEWARE (Clickjacking protection) - Helmet handles the rest
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

// 2. JWT TOKEN AUTHENTICATION MIDDLEWARE
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Pass non-API requests straight through
  if (typeof req.path !== 'string' || !req.path.startsWith('/api/')) {
    return next();
  }

  // Public paths bypass token authentication
  const publicPaths = [
    '/api/login',
    '/api/demo-login',
    '/api/register',
    '/api/forgot-password',
    '/api/reset-password',
    '/api/health',
    '/api/baru',
    '/api/supplier/register',
    '/api/supplier/login',
    '/api/send-otp',
    '/api/simulated-midtrans/token',
    '/api/google-auth',
    '/api/refresh-token',
    '/api/logout'
  ];

  const isPublic = publicPaths.includes(req.path) || req.path.startsWith('/api/table-public/');
  if (isPublic) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (token === 'null' || token === 'undefined') {
    token = undefined;
  }

  if (!token && req.cookies) {
    token = req.cookies.token;
  }

  if (!token) {
    securityLogger.warn(`[UNAUTHORIZED ACCESS] Attempt to access ${req.path} without a token from IP ${req.ip}`);
    return res.status(401).json({ success: false, message: 'Status 401: Akses ditolak. Sesi autentikasi diperlukan.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = {
      id: decoded.id || decoded.sub,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId, // DILARANG identity fallback via HTTP
      supplierId: decoded.role === 'SUPPLIER_PARTNER' ? decoded.id : decoded.supplierId
    };
    next();
  } catch (err: any) {
    securityLogger.info(`[EXPIRED/INVALID TOKEN] JWT verification failed on route ${req.path}: ${err.message}`);
    return res.status(403).json({ success: false, message: 'Sesi kedaluwarsa atau token tidak valid. Silakan login kembali.' });
  }
};

// 3. ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
export const authorizeRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Only intercept API calls
    if (typeof req.path !== 'string' || !req.path.startsWith('/api/')) {
      return next();
    }

    const publicPaths = [
    '/api/login',
    '/api/demo-login',
    '/api/register',
    '/api/forgot-password',
    '/api/reset-password',
    '/api/health',
    '/api/supplier/register',
    '/api/supplier/login',
    '/api/send-otp',
    '/api/simulated-midtrans/token'
  ];

    const isPublic = publicPaths.includes(req.path) || req.path.startsWith('/api/table-public/');
    if (isPublic) {
      return next();
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
    }

    // Role mapping normalization (standardizing match to lower case)
    const normalizedUserRole = user.role?.toLowerCase() || '';
    
    // Superadmin bypasses all role checks
    if (normalizedUserRole === 'superadmin' || normalizedUserRole === 'super_admin') {
      return next();
    }

    const isAllowed = allowedRoles.some(role => role.toLowerCase() === normalizedUserRole);

    if (!isAllowed) {
      securityLogger.warn(`[AUTH FORBIDDEN] User ${user.email} (Role: ${user.role}) denied access to ${req.method} ${req.path}`);
      return res.status(403).json({ 
        success: false, 
        message: `Hak akses ditolak. Fungsi ini membutuhkan hak akses peran: [${allowedRoles.join(', ')}]. Peran Anda saat ini: ${user.role}.` 
      });
    }

    next();
  };
};

// 4. TENANT ISOLATION SANITY CHECKER
export const enforceTenantBoundary = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (typeof req.path !== 'string' || !req.path.startsWith('/api/')) {
    return next();
  }
  
  const user = req.user;
  if (!user) return next();

  // ONLY Superadmin is allowed to explicitly bypass tenant context using this header (strict isolation).
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (user.role?.toLowerCase() === 'superadmin' || user.role?.toLowerCase() === 'super_admin') {
    if (headerTenantId) {
      user.tenantId = headerTenantId;
    }
    return next();
  }
  
  if ((user.role?.toLowerCase() === 'supplier_partner' || user.role?.toLowerCase() === 'supplier') && req.path.startsWith('/api/supplier/')) {
    return next();
  }

  if (!user.tenantId) {
    securityLogger.error(`[TENANT VIOLATION ATTEMPT] User ${user.email} missing tenant identity in JWT for path ${req.path}`);
    return res.status(403).json({ success: false, message: 'Identitas penyewa hilang dari sesi Anda.' });
  }

  // FORCE TENANT ISOLATION (Ignore X-Tenant-Id entirely for non-superadmins and use JWT tenantId)
  if (req.body && typeof req.body === 'object') {
     // Optional: override any tenantId in payload with the securely identified tenantId from JWT
     // req.body.tenantId = user.tenantId; // Might break DTOs, handled safely in repos
  }
  
  next();
};

