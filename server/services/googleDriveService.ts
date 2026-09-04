import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { env } from '../env.ts';
import { logger } from '../logger.js';

export class GoogleDriveService {
  private drive: drive_v3.Drive;

  constructor() {
    const auth = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
    );

    if (env.GOOGLE_REFRESH_TOKEN) {
      auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
    }

    this.drive = google.drive({ version: 'v3', auth });
  }

  async uploadBackup(fileName: string, mimeType: string, fileContent: string): Promise<string> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          mimeType,
        },
        media: {
          mimeType,
          body: Readable.from([fileContent]),
        },
        fields: 'id',
      });
      return response.data.id || '';
    } catch (error: any) {
      logger.error(`[GoogleDriveService] Failed to upload backup: ${error.message}`);
      throw error;
    }
  }

  async listBackups(prefix: string): Promise<drive_v3.Schema$File[]> {
    try {
      const response = await this.drive.files.list({
        q: `name contains '${prefix}' and mimeType='application/json'`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'createdTime desc',
      });
      return response.data.files || [];
    } catch (error: any) {
      logger.error(`[GoogleDriveService] Failed to list backups: ${error.message}`);
      throw error;
    }
  }

  async restoreBackup(fileId: string): Promise<string> {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      
      return new Promise((resolve, reject) => {
        let str = '';
        response.data.on('data', (chunk: any) => str += chunk);
        response.data.on('end', () => resolve(str));
        response.data.on('error', reject);
      });
    } catch (error: any) {
      logger.error(`[GoogleDriveService] Failed to restore backup: ${error.message}`);
      throw error;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
