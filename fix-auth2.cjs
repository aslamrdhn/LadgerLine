const fs = require('fs');
let code = fs.readFileSync('server/routes/auth.ts', 'utf8');

code = code.replace(
  /const token = UserService\.generateToken\(\{\s*id: matchedTenant\.id,\s*email: matchedTenant\.cashierEmail \|\| matchedTenant\.ownerEmail,\s*role: 'Kasir',\s*tenantId: matchedTenant\.id\s*\}\);\s*setAuthCookie\(res, token\);\s*return res\.json\(\{[\s\S]*?token,[\s\S]*?tenant: matchedTenant\s*\}\);/g,
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
  /const token = UserService\.generateToken\(\{\s*id: matchedTenant\.id,\s*email: matchedTenant\.cashierEmail \|\| matchedTenant\.ownerEmail,\s*role: 'Owner', \/\/ Always 'Owner' when matching owner password!\s*tenantId: matchedTenant\.id\s*\}\);\s*setAuthCookie\(res, token\);\s*res\.json\(\{[\s\S]*?token,[\s\S]*?tenant: matchedTenant\s*\}\);/g,
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
  /const token = UserService\.generateToken\(\{\s*id: tenant\.id,\s*email: tenant\.cashierEmail,\s*role: 'Owner',\s*tenantId: tenant\.id\s*\}\);\s*setAuthCookie\(res, token\);\s*res\.json\(\{[\s\S]*?token,[\s\S]*?tenant\s*\}\);/g,
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
