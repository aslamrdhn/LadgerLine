import { execSync } from 'child_process';
const user = process.env.SQL_USER;
const password = process.env.SQL_PASSWORD || '';
const dbname = process.env.SQL_DB_NAME;
const host = process.env.SQL_HOST;
const dbUrl = `postgresql://${user}:${encodeURIComponent(password)}@localhost/${dbname}?host=${host}`;

try {
  const output = execSync(`npx prisma migrate diff --from-url "${dbUrl}" --to-schema-datamodel ./prisma/schema.prisma --script`, {
    env: { ...process.env, DATABASE_URL: dbUrl }
  });
  console.log(output.toString());
} catch (err) {
  console.error(err.stdout?.toString());
  console.error(err.stderr?.toString());
}
