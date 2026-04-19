/**
 * Authentication Manager for KittenKong Client
 *
 * PURPOSE:
 * Manages authentication with FunkyGibbon server including admin/guest login,
 * token persistence, automatic refresh, and QR code generation for guest access.
 *
 * FEATURES:
 * - Admin password authentication
 * - Guest QR code authentication
 * - Automatic token persistence to disk
 * - Token expiration checking
 * - Permission-based access control
 * - Token refresh for admin users
 * - Guest QR code generation
 *
 * VERSION HISTORY:
 * - 2025-04-02: Initial TypeScript port from Python blowing-off auth module
 *
 * PORTED FROM:
 * Python: blowing-off/blowingoff/auth.py
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface AuthManagerOptions {
  serverUrl: string;
  tokenFile?: string;
}

interface TokenData {
  token: string;
  expires: string;
  role: string;
  permissions: string[];
}

interface QRData {
  type: string;
  server: string;
  port: number;
  token: string;
}

interface LoginResponse {
  access_token: string;
  role: string;
  expires_in: number;
}

interface QRResponse {
  qr_code: string;
  qr_data: string;
  expires_in: number;
}

/**
 * Permission levels by role
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['read', 'write', 'delete', 'configure'],
  user: ['read', 'write'],
  guest: ['read']
};

export class AuthManager {
  serverUrl: string;
  tokenFile: string;
  token: string | null = null;
  tokenExpires: Date | null = null;
  role: string | null = null;
  permissions: string[] = [];

  constructor(options: AuthManagerOptions) {
    // Normalize server URL (remove trailing slash)
    this.serverUrl = options.serverUrl.replace(/\/$/, '');

    // Default token file location
    this.tokenFile = options.tokenFile || path.join(process.cwd(), '.kittenkong-token.json');
  }

  /**
   * Load saved token from disk if it exists and is valid
   */
  async loadToken(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.tokenFile, 'utf-8');
      const data: TokenData = JSON.parse(fileContent);

      // Check if token is expired
      const expires = new Date(data.expires);
      if (expires > new Date()) {
        this.token = data.token;
        this.tokenExpires = expires;
        this.role = data.role;
        this.permissions = data.permissions || [];
      }
    } catch (error) {
      // File doesn't exist or is invalid - that's okay
      // Token will remain null
    }
  }

  /**
   * Save current token to disk
   */
  async saveToken(): Promise<void> {
    if (!this.token || !this.tokenExpires) {
      return;
    }

    // Ensure directory exists
    const dir = path.dirname(this.tokenFile);
    await fs.mkdir(dir, { recursive: true });

    const data: TokenData = {
      token: this.token,
      expires: this.tokenExpires.toISOString(),
      role: this.role || 'user',
      permissions: this.permissions
    };

    await fs.writeFile(this.tokenFile, JSON.stringify(data, null, 2));
  }

  /**
   * Login as admin using password
   */
  async loginAdmin(password: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/v1/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as LoginResponse;

      this.token = data.access_token;
      this.role = data.role;
      this.permissions = ROLE_PERMISSIONS[data.role] || [];
      this.tokenExpires = new Date(Date.now() + data.expires_in * 1000);

      await this.saveToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Login as guest using QR code data
   */
  async loginGuest(qrData: string): Promise<boolean> {
    try {
      // Parse QR code data
      const data: QRData = JSON.parse(qrData);

      // Validate QR code type
      if (data.type !== 'guest_access') {
        return false;
      }

      // Update server URL from QR code
      this.serverUrl = `http://${data.server}:${data.port}`;

      // Exchange QR token for access token
      const response = await fetch(`${this.serverUrl}/api/v1/auth/guest/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: data.token })
      });

      if (!response.ok) {
        return false;
      }

      const loginData = await response.json() as LoginResponse;

      this.token = loginData.access_token;
      this.role = loginData.role;
      this.permissions = ROLE_PERMISSIONS[loginData.role] || [];
      this.tokenExpires = new Date(Date.now() + loginData.expires_in * 1000);

      await this.saveToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if currently authenticated with valid token
   */
  isAuthenticated(): boolean {
    if (!this.token || !this.tokenExpires) {
      return false;
    }
    return this.tokenExpires > new Date();
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  /**
   * Get authorization headers for API requests
   */
  getHeaders(): Record<string, string> {
    if (!this.token) {
      return {};
    }
    return {
      Authorization: `Bearer ${this.token}`
    };
  }

  /**
   * Logout and clear all authentication state
   */
  async logout(): Promise<void> {
    this.token = null;
    this.tokenExpires = null;
    this.role = null;
    this.permissions = [];

    // Remove token file
    try {
      await fs.unlink(this.tokenFile);
    } catch (error) {
      // File might not exist - that's okay
    }
  }

  /**
   * Refresh authentication token (admin only)
   */
  async refreshToken(): Promise<boolean> {
    if (!this.token || this.role !== 'admin') {
      return false;
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as Pick<LoginResponse, 'access_token' | 'expires_in'>;

      this.token = data.access_token;
      this.tokenExpires = new Date(Date.now() + data.expires_in * 1000);

      await this.saveToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate guest QR code (admin only)
   */
  async generateGuestQR(durationHours: number = 24): Promise<QRResponse | null> {
    if (this.role !== 'admin') {
      return null;
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/v1/auth/guest/generate-qr`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ duration_hours: durationHours })
      });

      if (!response.ok) {
        return null;
      }

      return await response.json() as QRResponse;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save guest QR code image to file
   */
  async saveGuestQR(qrData: QRResponse | null | any, outputPath: string): Promise<void> {
    if (!qrData || !qrData.qr_code) {
      return;
    }

    // Decode base64 image data
    const imageData = Buffer.from(qrData.qr_code, 'base64');

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(outputPath, imageData);
  }
}
