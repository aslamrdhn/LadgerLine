import { execSync } from 'child_process';
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD || '';
const dbname = process.env.SQL_DB_NAME;
const host = process.env.SQL_HOST;
const dbUrl = `postgresql://${user}:${encodeURIComponent(password)}@localhost/${dbname}?host=${host}`;
console.log('Running prisma db push with admin user...');
try {
  const output = execSync(`npx prisma db push --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: 'utf-8'
  });
  console.log(output);
} catch (err) {
  console.error(err.stdout);
  console.error(err.stderr);
}
