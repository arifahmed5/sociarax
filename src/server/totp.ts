import crypto from 'crypto';
import QRCode from 'qrcode';

// Base32 Alphabet (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate random base32 secret (160 bits / 20 bytes => 32 chars)
 */
export function generateTotpSecret(length: number = 32): string {
  const randomBytes = crypto.randomBytes(20);
  let secret = '';
  for (let i = 0; i < randomBytes.length; i++) {
    secret += BASE32_ALPHABET[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Decode Base32 string to Buffer
 */
function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Generate 6-digit TOTP code for a secret at a specific counter time
 */
export function generateTotpCode(secret: string, timeStep: number = 30, timeOffset: number = 0): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000) + (timeOffset * timeStep);
  const counter = Math.floor(epoch / timeStep);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  );

  const otp = (binaryCode % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Verify a 6-digit TOTP token against secret with ±1 time step tolerance (prevents clock drift issues)
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  if (!token || !secret || token.trim().length !== 6) {
    return false;
  }
  const cleanToken = token.trim();
  
  // Check current time step, -1 time step, +1 time step
  for (const offset of [0, -1, 1]) {
    const generated = generateTotpCode(secret, 30, offset);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(generated))) {
      return true;
    }
  }
  return false;
}

/**
 * Generate otpauth:// URI and QR Code Data URL for Google Authenticator
 */
export async function generateTotpQrCode(
  accountName: string,
  issuer: string = 'SociaraX',
  secret: string
): Promise<{ otpauthUrl: string; qrCodeDataUrl: string; manualKey: string }> {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  return {
    otpauthUrl,
    qrCodeDataUrl,
    manualKey: secret.match(/.{1,4}/g)?.join(' ') || secret,
  };
}

/**
 * AES-256-GCM Encryption for sensitive secrets at rest (e.g. TOTP secrets, Provider API keys).
 * Dynamically resolves encryption secrets from server environment variables and supports
 * multi-key candidate fallback decryption (e.g. TOTP_ENCRYPTION_KEY, SESSION_SECRET, LEGACY_ENCRYPTION_KEY).
 * This ensures that existing encrypted database secrets remain decryptable even if keys differ across environments.
 */

export function getPrimaryEncryptionKey(): string {
  return (
    process.env.TOTP_ENCRYPTION_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    'sociarax_default_master_encryption_key_2026'
  );
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const secret = getPrimaryEncryptionKey();
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) return encryptedPayload; // fallback if plain text was stored

  const [ivHex, authTagHex, encryptedText] = parts;
  if (!ivHex || !authTagHex || !encryptedText) return encryptedPayload;

  let iv: Buffer;
  let authTag: Buffer;
  try {
    iv = Buffer.from(ivHex, 'hex');
    authTag = Buffer.from(authTagHex, 'hex');
  } catch {
    return '';
  }

  // Prioritized candidate keys loaded strictly from server-side environment variables:
  // 1. TOTP_ENCRYPTION_KEY
  // 2. SESSION_SECRET
  // 3. LEGACY_ENCRYPTION_KEY (for databases initialized with earlier master keys)
  // 4. Other server-side key aliases
  const candidates = [
    process.env.TOTP_ENCRYPTION_KEY?.trim(),
    process.env.SESSION_SECRET?.trim(),
    process.env.LEGACY_ENCRYPTION_KEY?.trim(),
    process.env.DATA_ENCRYPTION_KEY?.trim(),
    process.env.ENCRYPTION_KEY?.trim(),
    process.env.OLD_ENCRYPTION_KEY?.trim(),
    'sociarax_default_master_encryption_key_2026',
    'sociarax_totp_encryption_secret_key',
    'sociarax_super_secret_session_key_min_32_chars',
  ].filter((k): k is string => Boolean(k && k.length > 0));

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    try {
      const key = crypto.createHash('sha256').update(candidate).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Key mismatch or auth tag validation failed for this candidate, try next candidate
      continue;
    }
  }

  return '';
}
