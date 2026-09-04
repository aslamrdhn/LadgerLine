const fs = require('fs');
const url = `postgresql://${process.env.SQL_USER}:${process.env.SQL_PASSWORD}@${process.env.SQL_HOST}:5432/${process.env.SQL_DB_NAME}?schema=public`;
console.log("DB URL constructed.");
process.env.DATABASE_URL = url;
const { execSync } = require('child_process');
try {
  execSync('npx prisma db push', { env: process.env, stdio: 'inherit' });
} catch (e) {
  process.exit(1);
}
