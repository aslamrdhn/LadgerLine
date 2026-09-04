import { logger } from './logger.js';
import { env } from './env.ts';

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`[RETRY] Operation failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms. Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

export async function triggerWhatsAppNotification(phone: string, message: string) {
  const apiKey = process.env.WHATSAPP_API_KEY;
  logger.info(`[WHATSAPP DISPATCH] Sending WhatsApp to: ${phone}`);
  
  if (!apiKey) {
    logger.warn('[WHATSAPP WARNING] WHATSAPP_API_KEY is not configured. Skipping WhatsApp SMS dispatch.');
    return;
  }

  try {
    await executeWithRetry(async () => {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: phone,
          message: message
        })
      });
      if (!response.ok) {
        throw new Error(`Fonnte API HTTP error ${response.status}`);
      }
      const result = await response.json();
      logger.info(`[WHATSAPP SUCCESS] Fonnte API response dispatch status: ${JSON.stringify(result)}`);
    }, 3, 1000);
  } catch (err: any) {
    logger.error(`[WHATSAPP ERROR] Failed to send notification through Fonnte after retries: ${err.message}`);
  }
}

export async function sendBrevoEmail(toEmail: string, subject: string, htmlContent: string) {
  const apiKey = env.BREVO_API_KEY || process.env.BREVO_API_KEY;
  logger.info(`[BREVO DISPATCH] Preparing transactional email to: ${toEmail}. Subject: "${subject}"`);

  if (!apiKey) {
    logger.warn('[BREVO WARNING] BREVO_API_KEY is missing. Email will NOT be sent.');
    throw new Error("Konfigurasi email (BREVO_API_KEY) belum disetel. Hubungi admin.");
  }

  try {
    const success = await executeWithRetry(async () => {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: 'LedgerLine Security Hub',
            email: 'agoraruangsemesta@gmail.com'
          },
          to: [
            {
              email: toEmail
            }
          ],
          subject: subject,
          htmlContent: htmlContent
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned error status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      logger.info(`[BREVO SUCCESS] Email successfully dispatched: ${JSON.stringify(result)}`);
      return true;
    }, 3, 1000);
    return success;
  } catch (err: any) {
    logger.error(`[BREVO ERROR] Failed to send email via Brevo after retries: ${err.message}`);
    // We only throw if it's super critical, but per instructions, log and return false instead of crashing.
    return false;
  }
}
