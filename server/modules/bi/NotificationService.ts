import { getPrismaClient } from '../../db.js';
import { logger } from '../../logger.js';

export class NotificationService {
  /**
   * Central abstraction for sending critical alerts.
   * Can be extended to integrate real providers (WhatsApp, Email).
   */
  static async sendAlert(tenantId: string, subject: string, message: string, provider: 'WHATSAPP' | 'EMAIL' | 'IN_APP' = 'IN_APP', recipient: string = 'owner') {
    const prisma = getPrismaClient();
    try {
      // 1. Log to generic notification system for In-App UI
      if (provider === 'IN_APP') {
        await prisma.notification.create({
          data: {
            tenantId,
            title: subject,
            message,
            read: false,
          }
        });
      }

      // 2. Log to notification audit log for tracking
      await prisma.notificationLog.create({
        data: {
          tenantId,
          provider,
          recipient,
          subject,
          message,
          status: 'SENT', // Mocking success
        }
      });

      logger.info(`[NotificationService] Alert sent to ${recipient} via ${provider}. Subject: ${subject}`);
    } catch (error: any) {
      logger.error(`[NotificationService] Failed to send alert: ${error.message}`);
      
      // Attempt to log failure
      try {
        await prisma.notificationLog.create({
          data: {
            tenantId,
            provider,
            recipient,
            subject,
            message,
            status: 'FAILED',
            errorDetails: error.message
          }
        });
      } catch (e) {}
    }
  }
}
