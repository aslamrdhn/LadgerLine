import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

let url = fs.readFileSync('generated_url.txt', 'utf8').trim();

console.log('Running prisma db push & generate with URL', url.substring(0, 30) + '...');
execSync(`npx prisma db push --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit'
});
execSync(`npx prisma generate`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit'
});
