const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/await fastify\.register\(fastifyHelmet, \{[\s\S]*?crossOriginEmbedderPolicy: false, frameguard: false,\n  \}\);/, 'await fastify.register(fastifyHelmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, frameguard: false });');
fs.writeFileSync('server.ts', code);
