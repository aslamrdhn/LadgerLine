require('fs').writeFileSync('.env', `DATABASE_URL=postgresql://${process.env.SQL_USER}:${process.env.SQL_PASSWORD}@${process.env.SQL_HOST}:5432/${process.env.SQL_DB_NAME}?schema=public\n`);
