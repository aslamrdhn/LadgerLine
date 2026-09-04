const fs = require('fs');
let code = fs.readFileSync('server/routes/auth.ts', 'utf8');

// 1. Update setAuthCookie
code = code.replace(
  /const setAuthCookie = \(res: Response, token: string\) => \{[\s\S]*?\};/,
  `// Securely issues tokens via Set-Cookie and persists rotation state
const issueAuthCookies = async (res: Response, user: { id: string; email: string; role: string; tenantId: string }) => {
  const accessToken = UserService.generateToken(user);
  const refreshToken = UserService.generateRefreshToken(user);
  await UserService.saveRefreshToken(user.id, refreshToken);

  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};`
);

// 2. Replace token generation
code = code.replace(
  /const token = UserService\.generateToken\(\{\s*id: 'superadmin',\s*email: superadminEmail,\s*role: 'SUPER_ADMIN',\s*tenantId: 'system'\s*\}\);\s*setAuthCookie\(res, token\);\s*return res\.json\(\{[\s\S]*?token,[\s\S]*?\}\);/m,
  `const superUser = { id: 'superadmin', email: superadminEmail, role: 'SUPER_ADMIN', tenantId: 'system' };
      await issueAuthCookies(res, superUser);
      return res.json({
        success: true,
        user: superUser,
        tenant: {
          id: 'system',
          name: 'LedgerLine Internal System',
          ownerEmail: superadminEmail,
          cashierEmail: superadminEmail,
          status: 'verified',
          activeOperatorRole: 'SUPER_ADMIN'
        }
      });`
);

code = code.replace(
  /const token = UserService\.generateToken\(\{\s*id: matchedTenant\.id,\s*email: matchedTenant\.cashierEmail \|\| matchedTenant\.ownerEmail,\s*role: 'Kasir',\s*tenantId: matchedTenant\.id\s*\}\);\s*setAuthCookie\(res, token\);\s*return res\.json\(\{[\s\S]*?token,[\s\S]*?tenant: matchedTenant\s*\}\);/m,
  `const kasirUser = {
        id: matchedTenant.id,
        email: matchedTenant.cashierEmail || matchedTenant.ownerEmail,
        role: 'Kasir',
        tenantId: matchedTenant.id
      };
      await issueAuthCookies(res, kasirUser);

      return res.json({
        success: true,
        user: kasirUser,
        tenant: matchedTenant
      });`
);

code = code.replace(
  /const token = UserService\.generateToken\(\{\s*id: matchedTenant\.id,\s*email: matchedTenant\.cashierEmail \|\| matchedTenant\.ownerEmail,\s*role: 'Owner', \/\/ Always 'Owner' when matching owner password!\s*tenantId: matchedTenant\.id\s*\}\);\s*setAuthCookie\(res, token\);\s*res\.json\(\{[\s\S]*?token,[\s\S]*?tenant: matchedTenant\s*\}\);/m,
  `const ownerUser = {
      id: matchedTenant.id,
      email: matchedTenant.cashierEmail || matchedTenant.ownerEmail,
      role: 'Owner',
      tenantId: matchedTenant.id
    };
    await issueAuthCookies(res, ownerUser);

    res.json({
      success: true,
      user: ownerUser,
      tenant: matchedTenant
    });`
);

code = code.replace(
  /const token = UserService\.generateToken\(\{\s*id: tenant\.id,\s*email: tenant\.cashierEmail,\s*role: 'Owner',\s*tenantId: tenant\.id\s*\}\);\s*setAuthCookie\(res, token\);\s*res\.json\(\{[\s\S]*?token,[\s\S]*?tenant\s*\}\);/m,
  `const demoUser = {
      id: tenant.id,
      email: tenant.cashierEmail,
      role: 'Owner',
      tenantId: tenant.id
    };
    await issueAuthCookies(res, demoUser);

    res.json({
      success: true,
      user: demoUser,
      tenant
    });`
);

fs.writeFileSync('server/routes/auth.ts', code);
