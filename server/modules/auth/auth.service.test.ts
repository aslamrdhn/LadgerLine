import { AuthService } from './auth.service.ts';
import { AuthRepository } from './auth.repository.ts';

// Mock repository
class MockAuthRepository extends AuthRepository {
  async getTenant(tenantId: string) { return null; }
  async listTenants() { return []; }
  async updateTenantRole() {}
  async updateTenantPassword() {}
}

describe('AuthService', () => {
  let authService: AuthService;
  let mockRepo: MockAuthRepository;

  beforeEach(() => {
    mockRepo = new MockAuthRepository();
    authService = new AuthService(mockRepo);
  });

  it('should generate token correctly', () => {
    const payload = { id: 'test' };
    const token = authService.generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should hash password and verify it correctly', async () => {
    const password = 'securepassword123';
    const hash = await authService.hashPassword(password);
    expect(hash).not.toBe(password);
    
    // Login success simulation
    const isMatch = await authService.comparePasswords(password, hash);
    expect(isMatch).toBe(true);

    // Login failed simulation
    const isFalseMatch = await authService.comparePasswords('wrongpass', hash);
    expect(isFalseMatch).toBe(false);
  });

  it('should handle OTP lifecycle correctly', async () => {
    const email = 'test@example.com';
    const code = '1234';
    
    await authService.saveOtp(email, code);
    
    let isVerifed = await authService.verifyOtp(email, '0000');
    expect(isVerifed).toBe(false); // wrong otp
    
    // correct otp but also should clear it
    isVerifed = await authService.verifyOtp(email, code);
    expect(isVerifed).toBe(true); // right otp
    
    // re-using should fail
    isVerifed = await authService.verifyOtp(email, code);
    expect(isVerifed).toBe(false);
  });
});
