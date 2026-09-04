import { z } from 'zod';

export const LoginSchema = z.object({
  body: z.object({
    email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
    password: z.string().optional().or(z.literal('')),
    pin: z.string().optional().or(z.literal('')),
    tenantId: z.string().optional()
  }).refine(data => (data.email && data.password) || data.pin, {
    message: "Email dan sandi ATAU PIN kasir diperlukan",
    path: ["body"]
  }),
  query: z.any(),
  params: z.any(),
});

export const RegisterSchema = z.object({
  body: z.object({
    ownerName: z.string().min(2, "Nama pemilik minimal 2 karakter"),
    ownerEmail: z.string().email("Format email tidak valid"),
    phone: z.string().min(8, "Nomor WhatsApp tidak valid"),
    storeName: z.string().min(3, "Nama kedai minimal 3 karakter"),
    businessType: z.enum(['Coffee Shop', 'F&B', 'Retail']).optional().default('Coffee Shop'),
    password: z.string().min(6, "Sandi minimal 6 karakter")
  }),
  query: z.any(),
  params: z.any(),
});

export const SendOtpSchema = z.object({
  body: z.object({
    email: z.string().email("Format email tidak valid")
  }),
  query: z.any(),
  params: z.any(),
});

export const ForgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Format email tidak valid")
  }),
  query: z.any(),
  params: z.any(),
});

export const ResetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Format email tidak valid"),
    otp: z.string().length(6, "OTP harus 6 digit"),
    newPassword: z.string().min(6, "Sandi baru minimal 6 karakter")
  }),
  query: z.any(),
  params: z.any(),
});
