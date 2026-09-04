import midtransClient from 'midtrans-client';
import { env } from '../env.ts';
import { logger } from '../logger.js';

export class MidtransService {
  private snap: any;

  constructor() {
    this.snap = new midtransClient.Snap({
      isProduction: env.MIDTRANS_IS_PRODUCTION || false,
      serverKey: env.MIDTRANS_SERVER_KEY || 'dummy_server_key',
      clientKey: env.MIDTRANS_CLIENT_KEY || 'dummy_client_key'
    });
  }

  async createTransaction(orderId: string, grossAmount: number, customerDetails?: any) {
    try {
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: grossAmount
        },
        customer_details: customerDetails,
      };

      const transaction = await this.snap.createTransaction(parameter);
      return transaction.token;
    } catch (error: any) {
      logger.error(`[MidtransService] Failed to create transaction: ${error.message}`);
      throw error;
    }
  }

  async getStatus(orderId: string) {
    try {
      return await this.snap.transaction.status(orderId);
    } catch (error: any) {
      logger.error(`[MidtransService] Failed to get status: ${error.message}`);
      throw error;
    }
  }
}

export const midtransService = new MidtransService();
