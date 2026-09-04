const { execSync } = require('child_process');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const dbUrl = envFile.split('\n').find(line => line.startsWith('DATABASE_URL=')).replace('DATABASE_URL=', '');

try {
  execSync('npx prisma db push', { 
    env: { ...process.env, DATABASE_URL: dbUrl }, 
    stdio: 'inherit' 
  });
} catch (e) {
  process.exit(1);
}
