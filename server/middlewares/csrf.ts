import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const csrfDoubleSubmit = (req: Request, res: Response, next: NextFunction) => {
  // Always ensure a CSRF token exists
  if (!req.cookies['csrf-token']) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf-token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }

  const publicPaths = [
    '/api/login',
    '/api/demo-login',
    '/api/register',
    '/api/forgot-password',
    '/api/reset-password',
    '/api/supplier/register',
    '/api/supplier/login',
    '/api/send-otp',
    '/api/google-auth',
    '/api/refresh-token',
    '/api/logout'
  ];

  if (publicPaths.includes(req.path)) {
    return next();
  }

  // Safe methods skip CSRF check
  if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method)) {
    return next();
  }

  // State-changing method (POST, PUT, DELETE, PATCH)
  const cookieToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' });
  }

  next();
};
