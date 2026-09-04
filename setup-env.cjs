const fs = require('fs');
if (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME) {
  const user = process.env.SQL_USER;
  const password = process.env.SQL_PASSWORD || '';
  const dbname = process.env.SQL_DB_NAME;
  const host = process.env.SQL_HOST;
  const url = `postgresql://${user}:${encodeURIComponent(password)}@localhost/${dbname}?host=${host}`;
  
  let envContent = '';
  if (fs.existsSync('.env')) {
    envContent = fs.readFileSync('.env', 'utf8');
    envContent = envContent.split('\n').filter(l => !l.startsWith('DATABASE_URL=')).join('\n');
  }
  
  envContent += `\nDATABASE_URL=${url}\n`;
  fs.writeFileSync('.env', envContent.trim());
  console.log('Updated .env with Cloud SQL socket URL');
}
