const fs = require('fs');
let code = fs.readFileSync('server/routes/auth.ts', 'utf8');

code = code.replace(
  /router\.post\('\/register',\s*async \(req: Request, res: Response\) =>/g, 
  "router.post('/register', validateRequest(RegisterSchema), async (req: Request, res: Response) =>"
);

code = code.replace(
  /router\.post\('\/send-otp',\s*async \(req: Request, res: Response\) =>/g, 
  "router.post('/send-otp', validateRequest(SendOtpSchema), async (req: Request, res: Response) =>"
);

code = code.replace(
  /router\.post\('\/forgot-password',\s*async \(req: Request, res: Response\) =>/g, 
  "router.post('/forgot-password', validateRequest(ForgotPasswordSchema), async (req: Request, res: Response) =>"
);

code = code.replace(
  /router\.post\('\/reset-password',\s*async \(req: Request, res: Response\) =>/g, 
  "router.post('/reset-password', validateRequest(ResetPasswordSchema), async (req: Request, res: Response) =>"
);

fs.writeFileSync('server/routes/auth.ts', code);
