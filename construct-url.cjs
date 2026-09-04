const fs = require('fs');
const password = encodeURIComponent(process.env.SQL_PASSWORD || '');
const user = process.env.SQL_USER;
const dbName = process.env.SQL_DB_NAME;
const sqlHost = process.env.SQL_HOST;

const hostParam = typeof sqlHost === 'string' && sqlHost.startsWith('/') ? '?host=' + sqlHost : '';

const url = `postgresql://${user}:${password}@localhost:5432/${dbName}${hostParam}`;

fs.writeFileSync('.env', `DATABASE_URL="${url}"\n`);
console.log('Done');
