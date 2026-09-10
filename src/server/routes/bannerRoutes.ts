import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDbPool } from '../db';
import { requireAdminAuth } from '../auth';

export const bannerRouter = Router();

// Ensure upload directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'banners');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[BANNER] Could not initialize uploads directory:', e);
}

// Helper to normalize and validate target website URL
function normalizeAndValidateTargetUrl(rawUrl: string): { valid: boolean; normalizedUrl?: string; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: true, normalizedUrl: undefined };
  }

  const lower = trimmed.toLowerCase();
  // Reject dangerous schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return { valid: false, error: 'Unsafe or dangerous URL protocol is not allowed.' };
  }

  let urlToParse = trimmed;
  // If no scheme provided (e.g. "google.com", "www.example.com", "shop.example.com/page?id=1")
  if (!/^https?:\/\//i.test(trimmed)) {
    // If it has some other unknown colon protocol like "ftp:" or "ssh:", reject
    if (/^[a-zA-Z0-9+.-]+:/.test(trimmed)) {
      return { valid: false, error: 'Only HTTP and HTTPS web addresses are supported.' };
    }
    urlToParse = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(urlToParse);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTP and HTTPS web addresses are supported.' };
    }
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return { valid: false, error: 'Please enter a valid website address (e.g. example.com).' };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  } catch {
    return { valid: false, error: 'Invalid website URL format.' };
  }
}

// Helper to validate image URL
function isValidImageUrl(urlStr: string): boolean {
  if (urlStr.startsWith('/api/banner/image/')) return true;
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Public: Serve uploaded banner image files safely
 * GET /api/banner/image/:filename
 */
bannerRouter.get('/image/:filename', (req: Request, res: Response): void => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'Image not found' });
    return;
  }

  // Set appropriate caching (1 day)
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

/**
 * Public: Get current active, non-expired banner for User Panel
 * GET /api/banner/active
 */
bannerRouter.get('/active', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = getDbPool();
    const result = await db.query(`
      SELECT 
        id, 
        image_url, 
        target_url, 
        duration_hours, 
        published_at, 
        expires_at, 
        is_active,
        GREATEST(0, EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)))::int AS seconds_remaining
      FROM user_banners
      WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
      ORDER BY published_at DESC, id DESC
      LIMIT 1;
    `);

    if (result.rowCount === 0) {
      res.json({ success: true, banner: null });
      return;
    }

    const row = result.rows[0];
    res.json({
      success: true,
      banner: {
        id: row.id,
        imageUrl: row.image_url,
        targetUrl: row.target_url || null,
        durationHours: row.duration_hours,
        publishedAt: row.published_at,
        expiresAt: row.expires_at,
        secondsRemaining: row.seconds_remaining
      }
    });
  } catch (err: any) {
    console.error('[BANNER ACTIVE ERROR]:', err);
    // On any error, never break the user panel - gracefully return no banner
    res.json({ success: true, banner: null });
  }
});

/**
 * Admin: Get current active banner with administration stats
 * GET /api/admin/banner/current (or GET /api/banner/admin/current)
 */
bannerRouter.get(['/current', '/admin/current'], requireAdminAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = getDbPool();
    const result = await db.query(`
      SELECT 
        id, 
        image_url, 
        target_url, 
        duration_hours, 
        published_at, 
        expires_at, 
        is_active,
        GREATEST(0, EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)))::int AS seconds_remaining
      FROM user_banners
      WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
      ORDER BY published_at DESC, id DESC
      LIMIT 1;
    `);

    if (result.rowCount === 0) {
      res.json({ success: true, banner: null });
      return;
    }

    const row = result.rows[0];
    res.json({
      success: true,
      banner: {
        id: row.id,
        imageUrl: row.image_url,
        targetUrl: row.target_url || null,
        durationHours: row.duration_hours,
        publishedAt: row.published_at,
        expiresAt: row.expires_at,
        secondsRemaining: row.seconds_remaining
      }
    });
  } catch (err: any) {
    console.error('[ADMIN BANNER GET ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch banner status' });
  }
});

/**
 * Admin: Upload banner image file safely
 * POST /api/admin/banner/upload (or POST /api/banner/upload)
 */
bannerRouter.post(['/upload', '/admin/upload'], requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileBase64, filename, mimeType } = req.body || {};

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      res.status(400).json({ success: false, error: 'No image data provided' });
      return;
    }

    // Allowed image MIME types
    const allowedMimeTypes: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg'
    };

    const detectedMime = (mimeType || '').toLowerCase().trim();
    const extension = allowedMimeTypes[detectedMime];

    if (!extension) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid file type. Only JPEG, PNG, WEBP, GIF, and SVG images are allowed.' 
      });
      return;
    }

    // Strip Data URL prefix if present
    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Max file size: 5MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      res.status(400).json({ 
        success: false, 
        error: 'Image exceeds maximum allowable file size (5MB).' 
      });
      return;
    }

    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Generate safe unique filename
    const safeFilename = `banner_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${extension}`;
    const targetPath = path.join(UPLOADS_DIR, safeFilename);

    fs.writeFileSync(targetPath, buffer);

    const imageUrl = `/api/banner/image/${safeFilename}`;
    res.json({
      success: true,
      imageUrl,
      filename: safeFilename
    });
  } catch (err: any) {
    console.error('[ADMIN BANNER UPLOAD ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to upload image' });
  }
});

/**
 * Admin: Create and publish a temporary banner (max 24 hours duration)
 * POST /api/admin/banner (or POST /api/banner/admin)
 */
bannerRouter.post(['/', '/admin'], requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl, targetUrl, durationHours } = req.body || {};

    const hasImage = Boolean(imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '');
    const hasUrl = Boolean(targetUrl && typeof targetUrl === 'string' && targetUrl.trim() !== '');

    // Neither image nor URL provided
    if (!hasImage && !hasUrl) {
      res.status(400).json({
        success: false,
        error: 'Please upload an image or enter a website URL.'
      });
      return;
    }

    // Validate Image URL if provided
    let sanitizedImageUrl: string | null = null;
    if (hasImage) {
      const trimmedImg = imageUrl.trim();
      if (!isValidImageUrl(trimmedImg)) {
        res.status(400).json({
          success: false,
          error: 'Please upload an image or provide a valid HTTP/HTTPS image URL.'
        });
        return;
      }
      sanitizedImageUrl = trimmedImg;
    }

    // Validate and Normalize Target Website URL if provided
    let sanitizedTargetUrl: string | null = null;
    if (hasUrl) {
      const urlCheck = normalizeAndValidateTargetUrl(targetUrl);
      if (!urlCheck.valid || !urlCheck.normalizedUrl) {
        res.status(400).json({
          success: false,
          error: urlCheck.error || 'Please enter a valid website address (e.g. example.com).'
        });
        return;
      }
      sanitizedTargetUrl = urlCheck.normalizedUrl;
    }

    // Validate Duration (1 to 24 hours, default maximum is 24 hours)
    const rawHours = parseInt(String(durationHours || 24), 10);
    const validHours = Math.min(Math.max(1, isNaN(rawHours) ? 24 : rawHours), 24);

    const adminId = (req as any).admin?.id || (req as any).user?.id || 1;
    const db = getDbPool();

    // 1. Deactivate any currently active banners
    await db.query('UPDATE user_banners SET is_active = FALSE WHERE is_active = TRUE;');

    // Calculate exact server expiration
    const expiresAt = new Date(Date.now() + validHours * 3600 * 1000);

    // 2. Insert new banner with calculated server expiration
    const insertRes = await db.query(`
      INSERT INTO user_banners (
        image_url, 
        target_url, 
        duration_hours, 
        published_at, 
        expires_at, 
        is_active, 
        created_by
      )
      VALUES (
        $1, 
        $2, 
        $3, 
        CURRENT_TIMESTAMP, 
        $4, 
        TRUE, 
        $5
      )
      RETURNING 
        id, 
        image_url, 
        target_url, 
        duration_hours, 
        published_at, 
        expires_at, 
        is_active, 
        GREATEST(0, EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP)))::int AS seconds_remaining;
    `, [sanitizedImageUrl, sanitizedTargetUrl, validHours, expiresAt, adminId]);

    const created = insertRes.rows[0];

    res.json({
      success: true,
      message: `User banner successfully published for ${validHours} hours!`,
      banner: {
        id: created.id,
        imageUrl: created.image_url || null,
        targetUrl: created.target_url || null,
        durationHours: created.duration_hours,
        publishedAt: created.published_at,
        expiresAt: created.expires_at,
        secondsRemaining: created.seconds_remaining
      }
    });
  } catch (err: any) {
    console.error('[ADMIN BANNER CREATE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to publish banner' });
  }
});

/**
 * Admin: Immediately delete/deactivate active banner
 * DELETE /api/admin/banner (or DELETE /api/banner/admin)
 * Also supports /delete and /remove via POST/DELETE
 */
bannerRouter.all(['/delete', '/remove', '/admin/delete', '/admin/remove'], requireAdminAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = getDbPool();
    await db.query('UPDATE user_banners SET is_active = FALSE;');
    res.json({
      success: true,
      message: 'Active banner removed immediately.'
    });
  } catch (err: any) {
    console.error('[ADMIN BANNER DELETE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to remove active banner' });
  }
});

bannerRouter.delete(['/', '/admin', '/current', '/admin/current'], requireAdminAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = getDbPool();
    await db.query('UPDATE user_banners SET is_active = FALSE;');
    res.json({
      success: true,
      message: 'Active banner removed immediately.'
    });
  } catch (err: any) {
    console.error('[ADMIN BANNER DELETE ERROR]:', err);
    res.status(500).json({ success: false, error: 'Failed to remove active banner' });
  }
});
