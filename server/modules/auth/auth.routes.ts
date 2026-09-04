import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { authRateLimiter } from '../../middlewares/rateLimiter.js';

// Setting up dependencies
const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);
const authController = new AuthController(authService, authRepository);

const router = Router();

router.post('/login', authRateLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/send-otp', authRateLimiter, authController.sendOtp);
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);

export const authRouter = router;
export default authRouter;
