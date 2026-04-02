/**
 * Authentication Tests for KittenKong Client
 *
 * PURPOSE:
 * Tests authentication functionality including admin/guest login, token management,
 * QR code generation, and permission checking. Structured in BDD Given/When/Then format
 * for clarity and maintainability.
 *
 * TEST STRUCTURE:
 * - Uses Vitest with BDD-style describe/test blocks
 * - Each test follows Given/When/Then pattern
 * - Mocks HTTP requests using vi.mock()
 * - Tests both success and failure scenarios
 *
 * VERSION HISTORY:
 * - 2025-04-02: Initial port from Python blowing-off tests with BDD structure
 *
 * PORTED FROM:
 * Python: blowing-off/tests/unit/test_auth.py
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthManager } from '../src/auth';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('AuthManager', () => {
  let tempDir: string;
  let tempTokenFile: string;
  let authManager: AuthManager;

  beforeEach(async () => {
    // Given: A temporary directory for token storage
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kittenkong-test-'));
    tempTokenFile = path.join(tempDir, 'token.json');

    // Given: An AuthManager instance
    authManager = new AuthManager({
      serverUrl: 'http://localhost:8000',
      tokenFile: tempTokenFile
    });
  });

  afterEach(async () => {
    // Cleanup temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct default values', () => {
      // Given: Configuration from beforeEach

      // When: AuthManager is initialized (done in beforeEach)

      // Then: Properties should be set correctly
      expect(authManager.serverUrl).toBe('http://localhost:8000');
      expect(authManager.token).toBeNull();
      expect(authManager.tokenExpires).toBeNull();
      expect(authManager.role).toBeNull();
      expect(authManager.permissions).toEqual([]);
    });

    test('should strip trailing slash from server URL', () => {
      // Given: A server URL with trailing slash
      const authWithSlash = new AuthManager({
        serverUrl: 'http://localhost:8000/',
        tokenFile: tempTokenFile
      });

      // When: AuthManager normalizes the URL

      // Then: Trailing slash should be removed
      expect(authWithSlash.serverUrl).toBe('http://localhost:8000');
    });
  });

  describe('Token Loading', () => {
    test('should load valid saved token', async () => {
      // Given: A valid token file exists
      const validToken = {
        token: 'test-token-123',
        expires: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'configure']
      };
      await fs.writeFile(tempTokenFile, JSON.stringify(validToken));

      // When: AuthManager loads the token
      const auth = new AuthManager({
        serverUrl: 'http://localhost:8000',
        tokenFile: tempTokenFile
      });
      await auth.loadToken();

      // Then: Token should be loaded with correct values
      expect(auth.token).toBe('test-token-123');
      expect(auth.role).toBe('admin');
      expect(auth.permissions).toEqual(['read', 'write', 'delete', 'configure']);
      expect(auth.tokenExpires).not.toBeNull();
    });

    test('should not load expired token', async () => {
      // Given: An expired token file exists
      const expiredToken = {
        token: 'expired-token-123',
        expires: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        role: 'user',
        permissions: ['read']
      };
      await fs.writeFile(tempTokenFile, JSON.stringify(expiredToken));

      // When: AuthManager attempts to load the token
      const auth = new AuthManager({
        serverUrl: 'http://localhost:8000',
        tokenFile: tempTokenFile
      });
      await auth.loadToken();

      // Then: Token should not be loaded
      expect(auth.token).toBeNull();
      expect(auth.role).toBeNull();
      expect(auth.permissions).toEqual([]);
    });

    test('should handle invalid JSON gracefully', async () => {
      // Given: A token file with invalid JSON
      await fs.writeFile(tempTokenFile, 'invalid json content');

      // When: AuthManager attempts to load the token
      const auth = new AuthManager({
        serverUrl: 'http://localhost:8000',
        tokenFile: tempTokenFile
      });
      await auth.loadToken();

      // Then: Should not crash and token should be null
      expect(auth.token).toBeNull();
    });

    test('should handle missing token file gracefully', async () => {
      // Given: No token file exists
      const nonexistentFile = path.join(tempDir, 'nonexistent.json');

      // When: AuthManager attempts to load the token
      const auth = new AuthManager({
        serverUrl: 'http://localhost:8000',
        tokenFile: nonexistentFile
      });
      await auth.loadToken();

      // Then: Should not crash and token should be null
      expect(auth.token).toBeNull();
    });
  });

  describe('Token Saving', () => {
    test('should save token to file', async () => {
      // Given: AuthManager with token data
      authManager.token = 'saved-token-456';
      authManager.tokenExpires = new Date(Date.now() + 7200000); // 2 hours from now
      authManager.role = 'user';
      authManager.permissions = ['read', 'write'];

      // When: Token is saved
      await authManager.saveToken();

      // Then: File should contain correct data
      const fileContent = await fs.readFile(tempTokenFile, 'utf-8');
      const data = JSON.parse(fileContent);

      expect(data.token).toBe('saved-token-456');
      expect(data.role).toBe('user');
      expect(data.permissions).toEqual(['read', 'write']);
      expect(data.expires).toBeDefined();
    });

    test('should not save when no token is set', async () => {
      // Given: AuthManager with no token
      authManager.token = null;

      // When: Save is attempted
      await authManager.saveToken();

      // Then: File should not be created
      const fileExists = await fs.access(tempTokenFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });
  });

  describe('Admin Login', () => {
    test('should successfully login as admin', async () => {
      // Given: A mock successful API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'admin-token-789',
          role: 'admin',
          expires_in: 3600
        })
      });

      // When: Admin login is attempted
      const result = await authManager.loginAdmin('admin_password');

      // Then: Login should succeed and token should be set
      expect(result).toBe(true);
      expect(authManager.token).toBe('admin-token-789');
      expect(authManager.role).toBe('admin');
      expect(authManager.permissions).toEqual(['read', 'write', 'delete', 'configure']);
      expect(authManager.tokenExpires).not.toBeNull();
    });

    test('should fail login with wrong password', async () => {
      // Given: A mock failed API response (401)
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid credentials' })
      });

      // When: Admin login is attempted with wrong password
      const result = await authManager.loginAdmin('wrong_password');

      // Then: Login should fail and token should remain null
      expect(result).toBe(false);
      expect(authManager.token).toBeNull();
    });

    test('should handle network error', async () => {
      // Given: A mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // When: Admin login is attempted
      const result = await authManager.loginAdmin('admin_password');

      // Then: Login should fail gracefully
      expect(result).toBe(false);
      expect(authManager.token).toBeNull();
    });
  });

  describe('Guest Login', () => {
    test('should successfully login as guest with QR code', async () => {
      // Given: Valid QR code data and mock successful response
      const qrData = JSON.stringify({
        type: 'guest_access',
        server: 'localhost',
        port: 8000,
        token: 'guest-qr-token'
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'guest-token-123',
          role: 'guest',
          expires_in: 3600
        })
      });

      // When: Guest login is attempted
      const result = await authManager.loginGuest(qrData);

      // Then: Login should succeed
      expect(result).toBe(true);
      expect(authManager.token).toBe('guest-token-123');
      expect(authManager.role).toBe('guest');
      expect(authManager.permissions).toEqual(['read']);
    });

    test('should reject QR code with invalid type', async () => {
      // Given: QR code with wrong type
      const qrData = JSON.stringify({
        type: 'admin_access', // Wrong type
        server: 'localhost',
        port: 8000,
        token: 'token'
      });

      // When: Guest login is attempted
      const result = await authManager.loginGuest(qrData);

      // Then: Login should fail
      expect(result).toBe(false);
      expect(authManager.token).toBeNull();
    });

    test('should handle invalid JSON in QR code', async () => {
      // Given: Invalid JSON string
      const qrData = 'not valid json';

      // When: Guest login is attempted
      const result = await authManager.loginGuest(qrData);

      // Then: Login should fail gracefully
      expect(result).toBe(false);
      expect(authManager.token).toBeNull();
    });
  });

  describe('Authentication Status', () => {
    test('should return true for valid token', () => {
      // Given: A valid token that hasn't expired
      authManager.token = 'valid-token';
      authManager.tokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

      // When: Checking authentication status
      const isAuth = authManager.isAuthenticated();

      // Then: Should return true
      expect(isAuth).toBe(true);
    });

    test('should return false for expired token', () => {
      // Given: An expired token
      authManager.token = 'expired-token';
      authManager.tokenExpires = new Date(Date.now() - 3600000); // 1 hour ago

      // When: Checking authentication status
      const isAuth = authManager.isAuthenticated();

      // Then: Should return false
      expect(isAuth).toBe(false);
    });

    test('should return false when no token', () => {
      // Given: No token set
      authManager.token = null;

      // When: Checking authentication status
      const isAuth = authManager.isAuthenticated();

      // Then: Should return false
      expect(isAuth).toBe(false);
    });
  });

  describe('Permission Checks', () => {
    test('should validate admin permissions', () => {
      // Given: Admin user with all permissions
      authManager.role = 'admin';
      authManager.permissions = ['read', 'write', 'delete', 'configure'];

      // When/Then: All permission checks should pass
      expect(authManager.hasPermission('read')).toBe(true);
      expect(authManager.hasPermission('write')).toBe(true);
      expect(authManager.hasPermission('delete')).toBe(true);
      expect(authManager.hasPermission('configure')).toBe(true);
    });

    test('should validate regular user permissions', () => {
      // Given: Regular user with limited permissions
      authManager.role = 'user';
      authManager.permissions = ['read'];

      // When/Then: Only read permission should pass
      expect(authManager.hasPermission('read')).toBe(true);
      expect(authManager.hasPermission('write')).toBe(false);
      expect(authManager.hasPermission('delete')).toBe(false);
    });

    test('should deny all permissions when none set', () => {
      // Given: User with no permissions
      authManager.permissions = [];

      // When/Then: All permission checks should fail
      expect(authManager.hasPermission('read')).toBe(false);
      expect(authManager.hasPermission('write')).toBe(false);
    });
  });

  describe('Logout', () => {
    test('should clear all authentication state', async () => {
      // Given: Authenticated user with saved token
      authManager.token = 'active-token';
      authManager.tokenExpires = new Date(Date.now() + 3600000);
      authManager.role = 'user';
      authManager.permissions = ['read'];
      await authManager.saveToken();

      // When: User logs out
      await authManager.logout();

      // Then: All state should be cleared
      expect(authManager.token).toBeNull();
      expect(authManager.tokenExpires).toBeNull();
      expect(authManager.role).toBeNull();
      expect(authManager.permissions).toEqual([]);

      // And: Token file should be removed
      const fileExists = await fs.access(tempTokenFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });
  });

  describe('Token Refresh', () => {
    test('should successfully refresh admin token', async () => {
      // Given: Admin user with existing token
      authManager.token = 'old-token';
      authManager.role = 'admin';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'refreshed-token',
          expires_in: 3600
        })
      });

      // When: Token refresh is requested
      const result = await authManager.refreshToken();

      // Then: Token should be refreshed
      expect(result).toBe(true);
      expect(authManager.token).toBe('refreshed-token');
    });

    test('should fail refresh for non-admin', async () => {
      // Given: Non-admin user
      authManager.token = 'user-token';
      authManager.role = 'user';

      // When: Token refresh is attempted
      const result = await authManager.refreshToken();

      // Then: Refresh should fail
      expect(result).toBe(false);
    });

    test('should fail refresh when no token', async () => {
      // Given: No token set
      authManager.token = null;

      // When: Token refresh is attempted
      const result = await authManager.refreshToken();

      // Then: Refresh should fail
      expect(result).toBe(false);
    });
  });

  describe('Authorization Headers', () => {
    test('should return bearer token header', () => {
      // Given: User with valid token
      authManager.token = 'bearer-token';

      // When: Headers are requested
      const headers = authManager.getHeaders();

      // Then: Should contain authorization header
      expect(headers.Authorization).toBe('Bearer bearer-token');
    });

    test('should return empty object when no token', () => {
      // Given: No token set
      authManager.token = null;

      // When: Headers are requested
      const headers = authManager.getHeaders();

      // Then: Should return empty object
      expect(headers).toEqual({});
    });
  });

  describe('Guest QR Code Generation', () => {
    test('should generate QR code as admin', async () => {
      // Given: Admin user
      authManager.role = 'admin';
      authManager.token = 'admin-token';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          qr_code: 'base64encodedimage',
          qr_data: 'qr_data_json',
          expires_in: 86400
        })
      });

      // When: QR code generation is requested
      const result = await authManager.generateGuestQR(24);

      // Then: QR code should be generated
      expect(result).not.toBeNull();
      expect(result?.qr_code).toBe('base64encodedimage');
      expect(result?.qr_data).toBe('qr_data_json');
      expect(result?.expires_in).toBe(86400);
    });

    test('should fail QR generation for non-admin', async () => {
      // Given: Non-admin user
      authManager.role = 'user';

      // When: QR code generation is attempted
      const result = await authManager.generateGuestQR();

      // Then: Should return null
      expect(result).toBeNull();
    });
  });

  describe('QR Code Saving', () => {
    test('should save QR code to file', async () => {
      // Given: QR code data
      const qrData = {
        qr_code: Buffer.from('fake_image_data').toString('base64'),
        qr_data: 'data',
        expires_in: 3600
      };
      const outputFile = path.join(tempDir, 'test_qr.png');

      // When: QR code is saved
      await authManager.saveGuestQR(qrData, outputFile);

      // Then: File should exist with correct content
      const fileContent = await fs.readFile(outputFile);
      expect(fileContent.toString()).toBe('fake_image_data');
    });

    test('should handle missing QR data gracefully', async () => {
      // Given: No QR data

      // When: Save is attempted with null
      await authManager.saveGuestQR(null, 'test.png');

      // Then: Should not crash (no assertion needed, just shouldn't throw)
    });

    test('should handle missing qr_code field', async () => {
      // Given: QR data without qr_code field
      const qrData = { other: 'data' };

      // When: Save is attempted
      await authManager.saveGuestQR(qrData as any, 'test.png');

      // Then: Should not crash
    });
  });
});
