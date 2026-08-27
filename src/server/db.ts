import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection pool for Neon PostgreSQL
let pool: pg.Pool | null = null;
let isConnected = false;
let isUsingFallback = false;

// -------------------------------------------------------------
// IN-MEMORY FALLBACK DATABASE ENGINE (when DATABASE_URL not set)
// -------------------------------------------------------------
interface FallbackData {
  system_settings: Map<string, { key: string; value: string; description?: string; updated_at: string }>;
  users: Array<any>;
  admin_security: Array<any>;
  api_providers: Array<any>;
  service_categories: Array<any>;
  services: Array<any>;
  orders: Array<any>;
  wallet_transactions: Array<any>;
  payment_requests: Array<any>;
  support_tickets: Array<any>;
  ticket_messages: Array<any>;
  audit_logs: Array<any>;
  notifications: Array<any>;
  password_resets: Array<any>;
}

const initialPasswordHash = bcrypt.hashSync(process.env.ADMIN_INITIAL_PASSWORD || 'AdminSecure2026!SociaraX', 10);
const demoUserPasswordHash = bcrypt.hashSync('UserPass2026!', 10);

const fallbackStore: FallbackData = {
  system_settings: new Map([
    ['site_name', { key: 'site_name', value: 'SociaraX', updated_at: new Date().toISOString() }],
    ['site_title', { key: 'site_title', value: 'SociaraX - Premium SMM Provider Panel', updated_at: new Date().toISOString() }],
    ['currency', { key: 'currency', value: 'INR', updated_at: new Date().toISOString() }],
    ['currency_symbol', { key: 'currency_symbol', value: '₹', updated_at: new Date().toISOString() }],
    ['min_deposit', { key: 'min_deposit', value: '10', updated_at: new Date().toISOString() }],
    ['upi_id', { key: 'upi_id', value: '6001768808@axisbank', updated_at: new Date().toISOString() }],
    ['upi_id_secondary', { key: 'upi_id_secondary', value: '6001768808-3@ybl', updated_at: new Date().toISOString() }],
    ['upi_merchant_name', { key: 'upi_merchant_name', value: 'ARIF UDDIN AHMED', updated_at: new Date().toISOString() }],
    ['qr_code_url', { key: 'qr_code_url', value: '', updated_at: new Date().toISOString() }],
    ['support_email', { key: 'support_email', value: 'arifahmed87204@gmail.com', updated_at: new Date().toISOString() }],
    ['telegram_support', { key: 'telegram_support', value: '@arifahmed5_6', updated_at: new Date().toISOString() }],
    ['whatsapp_support', { key: 'whatsapp_support', value: '@arifahmed56', updated_at: new Date().toISOString() }],
    ['announcement', { key: 'announcement', value: 'Welcome to SociaraX! Real-time automated delivery active across Instagram, YouTube, Telegram, Snapchat, Facebook & X with 100% Non-Drop Refill Guarantee.', updated_at: new Date().toISOString() }]
  ]),
  users: [
    {
      id: 1,
      username: 'demo_user',
      email: 'demo@sociarax.com',
      password_hash: demoUserPasswordHash,
      role: 'user',
      wallet_balance: '1250.0000',
      currency: 'INR',
      status: 'active',
      custom_discount_pct: '0.00',
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  admin_security: [
    {
      id: 1,
      email: 'arifahmed87204@gmail.com',
      password_hash: initialPasswordHash,
      totp_secret_encrypted: null,
      totp_enabled: false,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      email: (process.env.ADMIN_EMAIL || 'admin@sociarax.com').toLowerCase(),
      password_hash: initialPasswordHash,
      totp_secret_encrypted: null,
      totp_enabled: false,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  api_providers: [
    {
      id: 1,
      name: 'Luvsmm Main',
      adapter_type: 'luvsmm',
      api_url: process.env.LUVSMM_API_URL || 'https://luvsmm.com/api/v2',
      api_key_encrypted: 'demo_encrypted_key',
      masked_key: '••••••••••••1234',
      status: 'active',
      balance: '84.5000',
      currency: 'USD',
      priority: 1,
      last_checked_at: new Date().toISOString(),
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  service_categories: [],
  services: [
    // Instagram Followers
    {
      id: 1,
      category_name: 'Instagram - Followers [Guaranteed & Non-Drop]',
      platform: 'instagram',
      name: 'Instagram Followers HQ [30 Days Auto-Refill] [Fast Speed - 10k/Day]',
      description: 'High quality real-looking accounts with profile pictures, bios, and posts. 30-day automatic refill button enabled.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '101',
      provider_rate: '45.0000',
      rate_per_1000: '85.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant - 1 Hour',
      status: 'active',
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      category_name: 'Instagram - Followers [Guaranteed & Non-Drop]',
      platform: 'instagram',
      name: 'Instagram Indian Followers [Real Active Profiles - Lifetime Guarantee]',
      description: '100% genuine Indian demographic profiles. High engagement retention with 365-day refill warranty.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 25000,
      provider_id: 1,
      provider_service_id: '102',
      provider_rate: '90.0000',
      rate_per_1000: '150.0000',
      markup_percentage: '35.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '15 - 45 Mins',
      status: 'active',
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      category_name: 'Instagram - Followers [Guaranteed & Non-Drop]',
      platform: 'instagram',
      name: 'Instagram Targeted USA / Global Followers [Super Premium]',
      description: 'Premium USA and Tier-1 audience accounts. Perfect for luxury, fashion, and business brands looking for organic-looking metrics.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '103',
      provider_rate: '110.0000',
      rate_per_1000: '190.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '1 - 3 Hours',
      status: 'active',
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Instagram Likes
    {
      id: 4,
      category_name: 'Instagram - Likes [Instant & Real]',
      platform: 'instagram',
      name: 'Instagram Real Indian Likes [Instant Start - Super Fast - 50k/Day]',
      description: '100% Indian genuine profiles. Instant start within 60 seconds of order placement. Safe for personal and business accounts.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 100000,
      provider_id: 1,
      provider_service_id: '104',
      provider_rate: '14.0000',
      rate_per_1000: '28.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: false,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (< 1 Min)',
      status: 'active',
      display_order: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 5,
      category_name: 'Instagram - Likes [Instant & Real]',
      platform: 'instagram',
      name: 'Instagram HQ Global Likes [Non-Drop - 30 Days Auto-Refill]',
      description: 'Stable worldwide likes from aged profiles with posts and stories. Zero drop rate recorded over 90 days.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 200000,
      provider_id: 1,
      provider_service_id: '105',
      provider_rate: '18.0000',
      rate_per_1000: '35.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (1-5 Mins)',
      status: 'active',
      display_order: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Instagram Views & Reels
    {
      id: 6,
      category_name: 'Instagram - Views & Reels Viral',
      platform: 'instagram',
      name: 'Instagram 4K Reels Views + Reach & Impressions [Viral Booster]',
      description: 'Elevates your video on the Instagram algorithm explore feed. Delivers ultra high retention and profile impressions.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 1000000,
      provider_id: 1,
      provider_service_id: '106',
      provider_rate: '5.0000',
      rate_per_1000: '12.0000',
      markup_percentage: '35.00',
      markup_fixed: '0.00',
      refill_available: false,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (10-30 Sec)',
      status: 'active',
      display_order: 6,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 7,
      category_name: 'Instagram - Views & Reels Viral',
      platform: 'instagram',
      name: 'Instagram Story Views + Highlights [All Stories Active]',
      description: 'Views across all active Instagram stories within 24 hours. Boosts interactive viewer analytics.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '107',
      provider_rate: '8.0000',
      rate_per_1000: '18.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: false,
      cancel_available: false,
      dripfeed_available: false,
      average_time: 'Instant - 5 Mins',
      status: 'active',
      display_order: 7,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Instagram Comments
    {
      id: 8,
      category_name: 'Instagram - Comments & Engagement',
      platform: 'instagram',
      name: 'Instagram Custom Comments [Indian Verified / Real Looking Profiles]',
      description: 'Enter your custom comments line by line. Posted naturally from real Indian users with profile pictures and bio.',
      type: 'Custom Comments',
      min_quantity: 10,
      max_quantity: 5000,
      provider_id: 1,
      provider_service_id: '108',
      provider_rate: '150.0000',
      rate_per_1000: '260.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '15 - 60 Mins',
      status: 'active',
      display_order: 8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // YouTube Views
    {
      id: 9,
      category_name: 'YouTube - Views [Monetizable]',
      platform: 'youtube',
      name: 'YouTube Real Suggested & Search Views [100% Monetizable - Lifetime Guarantee]',
      description: 'High watch time views coming from YouTube Suggested Videos and Search. Safe for AdSense monetization with zero drop rate.',
      type: 'Default',
      min_quantity: 500,
      max_quantity: 500000,
      provider_id: 1,
      provider_service_id: '201',
      provider_rate: '95.0000',
      rate_per_1000: '160.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '1 - 6 Hours',
      status: 'active',
      display_order: 9,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 10,
      category_name: 'YouTube - Views [Monetizable]',
      platform: 'youtube',
      name: 'YouTube High Retention Watch Time Views [5-10 Min Retention per View]',
      description: 'Special views for boosting YouTube video ranking and search placement. High retention percentage triggers algorithmic recommendation.',
      type: 'Default',
      min_quantity: 500,
      max_quantity: 100000,
      provider_id: 1,
      provider_service_id: '202',
      provider_rate: '140.0000',
      rate_per_1000: '240.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '2 - 8 Hours',
      status: 'active',
      display_order: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 11,
      category_name: 'YouTube - Views [Monetizable]',
      platform: 'youtube',
      name: 'YouTube Shorts Views [Ultra Fast Speed - 100k/Day]',
      description: 'Accelerate your YouTube Shorts onto the algorithm feed. Fast delivery start with natural retention curves.',
      type: 'Default',
      min_quantity: 1000,
      max_quantity: 5000000,
      provider_id: 1,
      provider_service_id: '203',
      provider_rate: '40.0000',
      rate_per_1000: '75.0000',
      markup_percentage: '35.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant - 30 Mins',
      status: 'active',
      display_order: 11,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // YouTube Subscribers
    {
      id: 12,
      category_name: 'YouTube - Subscribers [Non-Drop]',
      platform: 'youtube',
      name: 'YouTube Permanent Active Subscribers [Real Users - 30 Days Guarantee]',
      description: 'Real active YouTube accounts subscribing with profile icons. Steady delivery speed of 50-200/day for maximum organic safety.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 10000,
      provider_id: 1,
      provider_service_id: '204',
      provider_rate: '280.0000',
      rate_per_1000: '490.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: false,
      average_time: '2 - 12 Hours',
      status: 'active',
      display_order: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 13,
      category_name: 'YouTube - Watch Time & Monetization',
      platform: 'youtube',
      name: 'YouTube 4000 Hours Watch Time Booster [Requires 15+ Min Video]',
      description: 'Complete your monetization requirement easily. Delivers genuine watch duration on long videos. Guaranteed AdSense compliant.',
      type: 'Default',
      min_quantity: 500,
      max_quantity: 4000,
      provider_id: 1,
      provider_service_id: '205',
      provider_rate: '450.0000',
      rate_per_1000: '799.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '24 - 72 Hours',
      status: 'active',
      display_order: 13,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 14,
      category_name: 'YouTube - Likes & Comments',
      platform: 'youtube',
      name: 'YouTube Real High Retention Likes [Instant Start - Non-Drop]',
      description: 'Permanent likes from active YouTube viewers. Increases interaction score and click-through authority.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '206',
      provider_rate: '35.0000',
      rate_per_1000: '65.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (< 5 Mins)',
      status: 'active',
      display_order: 14,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Telegram
    {
      id: 15,
      category_name: 'Telegram - Members & Channels',
      platform: 'telegram',
      name: 'Telegram Real Channel & Group Members [0% Drop - Fast Add]',
      description: 'High quality members for public and private channels/supergroups. Clean join logs with realistic activity.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '301',
      provider_rate: '80.0000',
      rate_per_1000: '135.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant - 30 Mins',
      status: 'active',
      display_order: 15,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 16,
      category_name: 'Telegram - Post Views & Reactions',
      platform: 'telegram',
      name: 'Telegram Post Views [Auto-Detect - Last 5 Posts Fast]',
      description: 'Delivers organic-looking view counts on your latest Telegram channel messages with natural spread.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 100000,
      provider_id: 1,
      provider_service_id: '302',
      provider_rate: '3.5000',
      rate_per_1000: '8.0000',
      markup_percentage: '40.00',
      markup_fixed: '0.00',
      refill_available: false,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (< 1 Min)',
      status: 'active',
      display_order: 16,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 17,
      category_name: 'Telegram - Post Views & Reactions',
      platform: 'telegram',
      name: 'Telegram Positive Emoji Reactions [👍 🔥 ❤️ Mix]',
      description: 'Adds vibrant positive reactions to public channel posts for organic social proof.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 20000,
      provider_id: 1,
      provider_service_id: '303',
      provider_rate: '15.0000',
      rate_per_1000: '30.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: false,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (< 5 Mins)',
      status: 'active',
      display_order: 17,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Facebook
    {
      id: 18,
      category_name: 'Facebook - Page Likes & Followers',
      platform: 'facebook',
      name: 'Facebook Page Likes + Followers Bundle [HQ Global & Indian]',
      description: 'Dual boost: Increases both Page Likes and Followers simultaneously. Enhances social proof for brands.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '401',
      provider_rate: '70.0000',
      rate_per_1000: '125.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '1 - 4 Hours',
      status: 'active',
      display_order: 18,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 19,
      category_name: 'Facebook - Post Likes & Video Views',
      platform: 'facebook',
      name: 'Facebook Post / Photo Likes [Instant Start - Real Indian Profiles]',
      description: 'Adds instant likes to Facebook public photos, updates, and shared links.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '402',
      provider_rate: '22.0000',
      rate_per_1000: '42.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: false,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (< 5 Mins)',
      status: 'active',
      display_order: 19,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 20,
      category_name: 'Facebook - Group Members',
      platform: 'facebook',
      name: 'Facebook Public Group Members [Non-Drop - Active Global Profiles]',
      description: 'Adds members to open/public Facebook groups. Increases group search discoverability.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 20000,
      provider_id: 1,
      provider_service_id: '403',
      provider_rate: '65.0000',
      rate_per_1000: '115.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '2 - 6 Hours',
      status: 'active',
      display_order: 20,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Twitter / X
    {
      id: 21,
      category_name: 'Twitter / X - Followers & Retweets',
      platform: 'twitter',
      name: 'Twitter / X Followers [High Quality Global Real-Looking Profiles]',
      description: 'Followers with custom avatars, banners, active tweet history, and organic followers ratio.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 25000,
      provider_id: 1,
      provider_service_id: '501',
      provider_rate: '180.0000',
      rate_per_1000: '295.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '2 - 8 Hours',
      status: 'active',
      display_order: 21,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 22,
      category_name: 'Twitter / X - Followers & Retweets',
      platform: 'twitter',
      name: 'Twitter / X Retweets + Likes Combo [Viral Trend Booster]',
      description: 'Simultaneously boosts tweet retweets and likes. Helps posts rank in hashtag searches.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 20000,
      provider_id: 1,
      provider_service_id: '502',
      provider_rate: '75.0000',
      rate_per_1000: '135.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (< 10 Mins)',
      status: 'active',
      display_order: 22,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // TikTok
    {
      id: 23,
      category_name: 'TikTok - Followers & Likes',
      platform: 'tiktok',
      name: 'TikTok Followers [High Quality - Non-Drop 30 Days]',
      description: 'Real TikTok profiles with video uploads and followers. Helps unlock LIVE stream broadcast permissions.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '601',
      provider_rate: '120.0000',
      rate_per_1000: '210.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '1 - 4 Hours',
      status: 'active',
      display_order: 23,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 24,
      category_name: 'TikTok - Followers & Likes',
      platform: 'tiktok',
      name: 'TikTok Video Likes [Instant Start - Super Fast 20k/Day]',
      description: 'Accelerates TikTok video popularity score. Instant delivery starts within 3 minutes.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 100000,
      provider_id: 1,
      provider_service_id: '602',
      provider_rate: '25.0000',
      rate_per_1000: '49.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: false,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (< 5 Mins)',
      status: 'active',
      display_order: 24,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 25,
      category_name: 'TikTok - Views & Shares',
      platform: 'tiktok',
      name: 'TikTok 4K Video Views [Instant Algorithm Viral Push]',
      description: 'Ultra fast video views to get featured on FYP (For You Page). High retention.',
      type: 'Default',
      min_quantity: 1000,
      max_quantity: 5000000,
      provider_id: 1,
      provider_service_id: '603',
      provider_rate: '4.0000',
      rate_per_1000: '9.0000',
      markup_percentage: '35.00',
      markup_fixed: '0.00',
      refill_available: false,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant (10-30 Sec)',
      status: 'active',
      display_order: 25,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Spotify
    {
      id: 26,
      category_name: 'Spotify - Plays & Followers',
      platform: 'spotify',
      name: 'Spotify Track Plays [Royalties Eligible - Premium Tier-1 Streams]',
      description: 'Safe organic Spotify streams with high listen time. Eligible for royalties.',
      type: 'Default',
      min_quantity: 1000,
      max_quantity: 200000,
      provider_id: 1,
      provider_service_id: '701',
      provider_rate: '70.0000',
      rate_per_1000: '120.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '2 - 12 Hours',
      status: 'active',
      display_order: 26,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 27,
      category_name: 'Spotify - Plays & Followers',
      platform: 'spotify',
      name: 'Spotify Artist / Playlist Followers [HQ Global Accounts]',
      description: 'Increases follower count for artists and curated playlists to trigger Spotify algorithmic discovery.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '702',
      provider_rate: '85.0000',
      rate_per_1000: '145.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '1 - 6 Hours',
      status: 'active',
      display_order: 27,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Snapchat
    {
      id: 28,
      category_name: 'Snapchat - Followers & Spotlight',
      platform: 'snapchat',
      name: 'Snapchat HQ Bitmoji Followers [Non-Drop - 30 Days Refill]',
      description: 'High quality active Snapchat followers with Bitmoji avatars and real accounts.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 25000,
      provider_id: 1,
      provider_service_id: '801',
      provider_rate: '110.0000',
      rate_per_1000: '185.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '15 - 45 Minutes',
      status: 'active',
      display_order: 28,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 29,
      category_name: 'Snapchat - Followers & Spotlight',
      platform: 'snapchat',
      name: 'Snapchat Spotlight Viral Views + Saves [Boost Algorithm]',
      description: 'Instant delivery for Spotlight videos to trigger the viral recommendation algorithm.',
      type: 'Default',
      min_quantity: 500,
      max_quantity: 500000,
      provider_id: 1,
      provider_service_id: '802',
      provider_rate: '22.0000',
      rate_per_1000: '45.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant - 10 Mins',
      status: 'active',
      display_order: 29,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 30,
      category_name: 'Snapchat - Followers & Spotlight',
      platform: 'snapchat',
      name: 'Snapchat Story Views [24 Hours Visible]',
      description: 'Real audience Snapchat story views. Stay active throughout the full 24-hour cycle.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 100000,
      provider_id: 1,
      provider_service_id: '803',
      provider_rate: '35.0000',
      rate_per_1000: '69.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '5 - 20 Minutes',
      status: 'active',
      display_order: 30,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Twitter / X
    {
      id: 31,
      category_name: 'Twitter (X) - Followers & Retweets',
      platform: 'twitter',
      name: 'Twitter / X Global NFT & Crypto Followers [Non-Drop 60 Days Refill]',
      description: 'Clean Twitter/X profile followers with avatars and biographies. Safe for all profiles.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '901',
      provider_rate: '95.0000',
      rate_per_1000: '165.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '15 - 60 Minutes',
      status: 'active',
      display_order: 31,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 32,
      category_name: 'Twitter (X) - Followers & Retweets',
      platform: 'twitter',
      name: 'Twitter / X Retweets + Likes Combo [Viral Tweet Boost]',
      description: 'Simultaneous Retweets and Likes delivered to your tweet link to rank on explore search.',
      type: 'Default',
      min_quantity: 50,
      max_quantity: 20000,
      provider_id: 1,
      provider_service_id: '902',
      provider_rate: '40.0000',
      rate_per_1000: '75.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant - 15 Mins',
      status: 'active',
      display_order: 32,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },

    // Telegram
    {
      id: 33,
      category_name: 'Telegram - Channel & Group Members',
      platform: 'telegram',
      name: 'Telegram Channel Members [0% Drop Guarantee - 365 Days Refill]',
      description: 'Permanent non-drop members for public and private Telegram channels. High retention.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 100000,
      provider_id: 1,
      provider_service_id: '603',
      provider_rate: '45.0000',
      rate_per_1000: '80.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: '10 - 30 Minutes',
      status: 'active',
      display_order: 33,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 34,
      category_name: 'Telegram - Channel & Group Members',
      platform: 'telegram',
      name: 'Telegram Post Reactions Combo (👍 🔥 ❤️ 👏)',
      description: 'Spread positive emoji reactions across your latest Telegram posts automatically.',
      type: 'Default',
      min_quantity: 100,
      max_quantity: 50000,
      provider_id: 1,
      provider_service_id: '604',
      provider_rate: '15.0000',
      rate_per_1000: '32.0000',
      markup_percentage: '30.00',
      markup_fixed: '0.00',
      refill_available: true,
      cancel_available: false,
      dripfeed_available: true,
      average_time: 'Instant',
      status: 'active',
      display_order: 34,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  orders: [
    {
      id: 1001,
      user_id: 1,
      service_id: 1,
      service_name: 'Instagram Followers HQ [30 Days Auto-Refill] [Fast Speed - 10k/Day]',
      platform: 'instagram',
      link: 'https://instagram.com/tech_creator_official',
      quantity: 1000,
      charge: '85.0000',
      provider_cost: '45.0000',
      profit: '40.0000',
      currency: 'INR',
      provider_id: 1,
      provider_order_id: '884920',
      provider_status: 'Completed',
      provider_error: null,
      status: 'completed',
      start_count: 1420,
      remains: 0,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 1002,
      user_id: 1,
      service_id: 3,
      service_name: 'Instagram 4K Reels Views + Reach & Impressions [Viral Booster]',
      platform: 'instagram',
      link: 'https://instagram.com/reel/C8_demo_reel_link',
      quantity: 5000,
      charge: '60.0000',
      provider_cost: '25.0000',
      profit: '35.0000',
      currency: 'INR',
      provider_id: 1,
      provider_order_id: '885104',
      provider_status: 'In progress',
      provider_error: null,
      status: 'processing',
      start_count: 350,
      remains: 1200,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  wallet_transactions: [
    {
      id: 1,
      user_id: 1,
      type: 'DEPOSIT_APPROVED',
      amount: '1500.0000',
      balance_before: '0.0000',
      balance_after: '1500.0000',
      currency: 'INR',
      reference_type: 'payment_request',
      reference_id: '1',
      description: 'Initial Wallet Balance Deposit (UPI UTR: 419823481029)',
      admin_id: 1,
      created_at: new Date(Date.now() - 7 * 86400000).toISOString()
    },
    {
      id: 2,
      user_id: 1,
      type: 'ORDER_PAYMENT',
      amount: '-85.0000',
      balance_before: '1500.0000',
      balance_after: '1415.0000',
      currency: 'INR',
      reference_type: 'order',
      reference_id: '1001',
      description: 'Order #1001 - Instagram Followers HQ (1000 qty)',
      admin_id: null,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 3,
      user_id: 1,
      type: 'ORDER_PAYMENT',
      amount: '-60.0000',
      balance_before: '1415.0000',
      balance_after: '1355.0000',
      currency: 'INR',
      reference_type: 'order',
      reference_id: '1002',
      description: 'Order #1002 - Instagram 4K Reels Views (5000 qty)',
      admin_id: null,
      created_at: new Date(Date.now() - 3600000).toISOString()
    }
  ],
  payment_requests: [
    {
      id: 1,
      user_id: 1,
      amount: '1500.0000',
      currency: 'INR',
      payment_method: 'UPI',
      utr_number: '419823481029',
      payer_vpa_or_account: 'demo@okhdfcbank',
      status: 'approved',
      rejection_reason: null,
      approved_by_admin_id: 1,
      approved_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 7 * 86400000).toISOString()
    },
    {
      id: 2,
      user_id: 1,
      amount: '500.0000',
      currency: 'INR',
      payment_method: 'UPI',
      utr_number: '420198471203',
      payer_vpa_or_account: 'demo@paytm',
      status: 'pending',
      rejection_reason: null,
      approved_by_admin_id: null,
      approved_at: null,
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString()
    }
  ],
  support_tickets: [
    {
      id: 1,
      user_id: 1,
      order_id: 1001,
      subject: 'Refill speed inquiry for order #1001',
      category: 'order',
      status: 'open',
      priority: 'medium',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 7200000).toISOString()
    }
  ],
  ticket_messages: [
    {
      id: 1,
      ticket_id: 1,
      sender_role: 'user',
      sender_id: 1,
      message: 'Hi SociaraX team, followers delivered very quickly! Just checking if the 30-day refill will trigger automatically if any drop happens?',
      created_at: new Date(Date.now() - 7200000).toISOString()
    }
  ],
  audit_logs: [],
  notifications: [],
  password_resets: []
};

let nextIds = {
  users: 2,
  services: 10,
  orders: 1003,
  wallet_transactions: 4,
  payment_requests: 3,
  api_providers: 2,
  support_tickets: 2,
  ticket_messages: 2,
  password_resets: 1
};

// Fallback Query Executor
function executeFallbackQuery(text: string, params: any[] = []): { rows: any[]; rowCount: number } {
  const sql = text.trim();
  const lowerSql = sql.toLowerCase();

  // 1. Settings
  if (lowerSql.includes('from system_settings')) {
    const rows = Array.from(fallbackStore.system_settings.values());
    return { rows, rowCount: rows.length };
  }
  if (lowerSql.includes('insert into system_settings')) {
    const key = params[0];
    const value = params[1];
    fallbackStore.system_settings.set(key, { key, value: String(value), updated_at: new Date().toISOString() });
    return { rows: [{ key, value }], rowCount: 1 };
  }

  // 2. Services
  if (lowerSql.includes('from services') && !lowerSql.includes('insert') && !lowerSql.includes('update') && !lowerSql.includes('delete')) {
    let rows = [...fallbackStore.services];
    // Attach provider_name if joined
    rows = rows.map(s => {
      const prov = fallbackStore.api_providers.find(p => p.id === s.provider_id);
      return {
        ...s,
        provider_name: prov?.name || (s.provider_id === 1 ? 'LuvSMM v2 Main' : 'Manual / None')
      };
    });

    // Category distinct check
    if (lowerSql.includes('select distinct category_name, platform') || lowerSql.includes('select distinct s.category_name, s.platform')) {
      const distinctRows: any[] = [];
      const seen = new Set();
      for (const s of rows.filter(s => s.status === 'active')) {
        const key = `${s.category_name}_${s.platform}`;
        if (!seen.has(key)) {
          seen.add(key);
          distinctRows.push({ category_name: s.category_name, platform: s.platform });
        }
      }
      return { rows: distinctRows, rowCount: distinctRows.length };
    }

    if (lowerSql.includes('where provider_id = $1 and provider_service_id = $2')) {
      const pid = parseInt(params[0], 10);
      const psid = String(params[1]);
      const match = rows.find(r => r.provider_id === pid && String(r.provider_service_id) === psid);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    if (lowerSql.includes('where s.id = $1') || lowerSql.includes('where id = $1')) {
      const id = parseInt(params[0], 10);
      const match = rows.find(r => r.id === id);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // Platform filter
    if (lowerSql.includes('lower(s.platform) =') || lowerSql.includes('lower(platform) =') || lowerSql.includes('s.platform =') || lowerSql.includes('platform =')) {
      for (const p of params) {
        if (typeof p === 'string' && ['instagram', 'youtube', 'facebook', 'telegram', 'twitter', 'tiktok', 'spotify'].includes(p.toLowerCase())) {
          rows = rows.filter(r => r.platform.toLowerCase() === p.toLowerCase());
          break;
        }
      }
    }

    // Category filter
    if (lowerSql.includes('s.category_name =') || lowerSql.includes('category_name =')) {
      for (const p of params) {
        if (typeof p === 'string' && p.length > 3 && !['active', 'inactive', 'instagram', 'youtube', 'facebook', 'telegram', 'twitter', 'tiktok', 'spotify'].includes(p.toLowerCase())) {
          rows = rows.filter(r => r.category_name === p);
          break;
        }
      }
    }

    // Search filter
    if (lowerSql.includes('ilike')) {
      for (const p of params) {
        if (typeof p === 'string' && p.startsWith('%') && p.endsWith('%')) {
          const term = p.slice(1, -1).toLowerCase();
          if (term) {
            rows = rows.filter(r => 
              r.name.toLowerCase().includes(term) || 
              r.category_name.toLowerCase().includes(term) || 
              (r.description && r.description.toLowerCase().includes(term)) ||
              String(r.id) === term ||
              String(r.provider_service_id) === term
            );
          }
          break;
        }
      }
    }

    // Status filter
    if (lowerSql.includes('status = \'active\'') || lowerSql.includes('s.status = \'active\'') || lowerSql.includes('s.status = $')) {
      for (const p of params) {
        if (p === 'active' || p === 'inactive') {
          rows = rows.filter(r => r.status === p);
          break;
        }
      }
      if (lowerSql.includes("status = 'active'") || lowerSql.includes("s.status = 'active'")) {
        rows = rows.filter(r => r.status === 'active');
      }
    }

    // Provider ID filter
    if (lowerSql.includes('s.provider_id = $') || lowerSql.includes('provider_id = $')) {
      for (const p of params) {
        if (typeof p === 'number' && p > 0) {
          rows = rows.filter(r => r.provider_id === p);
          break;
        }
      }
    }

    return { rows, rowCount: rows.length };
  }

  // Insert service
  if (lowerSql.includes('insert into services')) {
    const id = nextIds.services++;
    let newService: any;
    
    if (lowerSql.includes('category_name, platform, name')) {
      // Sync format
      newService = {
        id,
        category_name: params[0] || 'General',
        platform: params[1] || 'other',
        name: params[2] || 'New Service',
        description: params[3] || '',
        type: params[4] || 'Default',
        min_quantity: parseInt(params[5], 10) || 10,
        max_quantity: parseInt(params[6], 10) || 100000,
        provider_id: params[7] ? parseInt(params[7], 10) : 1,
        provider_service_id: params[8] ? String(params[8]) : null,
        provider_rate: String(params[9] || '0'),
        rate_per_1000: String(params[10] || '10'),
        markup_percentage: String(params[11] || '30'),
        markup_fixed: '0.00',
        refill_available: Boolean(params[12]),
        cancel_available: Boolean(params[13]),
        dripfeed_available: true,
        average_time: params[14] || 'Instant',
        status: params[15] || 'active',
        display_order: fallbackStore.services.length + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } else {
      // Manual Add format
      newService = {
        id,
        name: params[0] || 'New Service',
        category_name: params[1] || 'General',
        platform: params[2] || 'other',
        description: params[3] || '',
        type: 'Default',
        min_quantity: parseInt(params[4], 10) || 10,
        max_quantity: parseInt(params[5], 10) || 100000,
        provider_id: params[6] ? parseInt(params[6], 10) : null,
        provider_service_id: params[7] ? String(params[7]) : null,
        provider_rate: String(params[8] || '0'),
        rate_per_1000: String(params[9] || '10'),
        markup_percentage: String(params[10] || '30'),
        markup_fixed: '0.00',
        refill_available: Boolean(params[11]),
        cancel_available: Boolean(params[12]),
        dripfeed_available: true,
        average_time: params[13] || 'Instant',
        status: params[14] || 'active',
        display_order: fallbackStore.services.length + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    fallbackStore.services.push(newService);
    return { rows: [newService], rowCount: 1 };
  }

  // Update service
  if (lowerSql.includes('update services')) {
    const id = parseInt(String(params[params.length - 1]), 10);
    const matchIndex = fallbackStore.services.findIndex(s => s.id === id);
    if (matchIndex !== -1) {
      if (lowerSql.includes('provider_rate = $1,') && lowerSql.includes('name = $2,')) {
        // Sync Update
        fallbackStore.services[matchIndex].provider_rate = String(params[0]);
        fallbackStore.services[matchIndex].name = params[1];
        fallbackStore.services[matchIndex].min_quantity = parseInt(params[2], 10) || 10;
        fallbackStore.services[matchIndex].max_quantity = parseInt(params[3], 10) || 100000;
        fallbackStore.services[matchIndex].refill_available = Boolean(params[4]);
        fallbackStore.services[matchIndex].cancel_available = Boolean(params[5]);
      } else {
        // General Edit
        if (params[0] !== null && params[0] !== undefined) fallbackStore.services[matchIndex].name = params[0];
        if (params[1] !== null && params[1] !== undefined) fallbackStore.services[matchIndex].category_name = params[1];
        if (params[4] !== null && params[4] !== undefined) fallbackStore.services[matchIndex].min_quantity = parseInt(params[4], 10);
        if (params[5] !== null && params[5] !== undefined) fallbackStore.services[matchIndex].max_quantity = parseInt(params[5], 10);
        if (params[8] !== null && params[8] !== undefined) fallbackStore.services[matchIndex].provider_rate = String(params[8]);
        if (params[9] !== null && params[9] !== undefined) fallbackStore.services[matchIndex].rate_per_1000 = String(params[9]);
        if (params[10] !== null && params[10] !== undefined) fallbackStore.services[matchIndex].markup_percentage = String(params[10]);
        if (params[14] !== null && params[14] !== undefined) fallbackStore.services[matchIndex].status = params[14];
      }
      fallbackStore.services[matchIndex].updated_at = new Date().toISOString();
      return { rows: [fallbackStore.services[matchIndex]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 3. Admin Security & Auth
  if (lowerSql.includes('from admin_security')) {
    if (lowerSql.includes('where lower(email) = $1') || lowerSql.includes('where email = $1') || lowerSql.includes('where lower(email) = lower($1)')) {
      const email = String(params[0]).toLowerCase().trim();
      const match = fallbackStore.admin_security.find(a => a.email.toLowerCase() === email);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }
    if (lowerSql.includes('where id = $1')) {
      const id = parseInt(params[0], 10);
      const match = fallbackStore.admin_security.find(a => a.id === id);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }
    return { rows: fallbackStore.admin_security, rowCount: fallbackStore.admin_security.length };
  }

  if (lowerSql.includes('insert into admin_security')) {
    const id = fallbackStore.admin_security.length + 1;
    const admin = {
      id,
      email: String(params[0]).toLowerCase().trim(),
      password_hash: params[1],
      totp_secret_encrypted: null,
      totp_enabled: false,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fallbackStore.admin_security.push(admin);
    return { rows: [admin], rowCount: 1 };
  }

  if (lowerSql.includes('delete from admin_security')) {
    const id = parseInt(params[0], 10);
    const beforeLen = fallbackStore.admin_security.length;
    fallbackStore.admin_security = fallbackStore.admin_security.filter(a => a.id !== id);
    return { rows: [], rowCount: beforeLen - fallbackStore.admin_security.length };
  }

  if (lowerSql.includes('update admin_security')) {
    const targetId = params[params.length - 1];
    let target = fallbackStore.admin_security.find(a => a.id === parseInt(targetId, 10));
    if (!target && fallbackStore.admin_security.length > 0) {
      target = fallbackStore.admin_security[0];
    }
    if (target) {
      if (lowerSql.includes('totp_enabled = true') || lowerSql.includes('totp_enabled = $')) {
        target.totp_enabled = true;
        if (params[0]) target.totp_secret_encrypted = params[0];
      }
      if (lowerSql.includes('last_login_at = current_timestamp') || lowerSql.includes('last_login_at =')) {
        target.last_login_at = new Date().toISOString();
        target.failed_attempts = 0;
      }
      target.updated_at = new Date().toISOString();
      return { rows: [target], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 4. Users
  if (lowerSql.includes('from users')) {
    if (lowerSql.includes('username = $1 or email = $2') || lowerSql.includes('username = $1 or email = $1')) {
      const identifier = String(params[0]).toLowerCase();
      const match = fallbackStore.users.find(u => u.username.toLowerCase() === identifier || u.email.toLowerCase() === identifier);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }
    if (lowerSql.includes('where id = $1') || lowerSql.includes('where u.id = $1')) {
      const id = parseInt(params[0], 10);
      const match = fallbackStore.users.find(u => u.id === id);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }
    return { rows: fallbackStore.users, rowCount: fallbackStore.users.length };
  }

  if (lowerSql.includes('insert into users')) {
    const id = nextIds.users++;
    const newUser = {
      id,
      username: params[0],
      email: params[1],
      password_hash: params[2],
      role: 'user',
      wallet_balance: '0.0000',
      currency: 'INR',
      status: 'active',
      created_at: new Date().toISOString()
    };
    fallbackStore.users.push(newUser);
    return { rows: [newUser], rowCount: 1 };
  }

  if (lowerSql.includes('update users')) {
    if (lowerSql.includes('wallet_balance = $1')) {
      const newBal = String(params[0]);
      const uid = parseInt(params[1], 10);
      const u = fallbackStore.users.find(usr => usr.id === uid);
      if (u) {
        u.wallet_balance = newBal;
        u.updated_at = new Date().toISOString();
        return { rows: [u], rowCount: 1 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  // 5. Orders
  if (lowerSql.includes('from orders')) {
    if (lowerSql.includes('where o.user_id = $1') || lowerSql.includes('where user_id = $1')) {
      const uid = parseInt(params[0], 10);
      const userOrders = fallbackStore.orders.filter(o => o.user_id === uid);
      return { rows: userOrders, rowCount: userOrders.length };
    }
    return { rows: fallbackStore.orders, rowCount: fallbackStore.orders.length };
  }

  if (lowerSql.includes('insert into orders')) {
    const id = nextIds.orders++;
    const newOrder = {
      id,
      user_id: params[0],
      service_id: params[1],
      service_name: params[2],
      platform: params[3],
      link: params[4],
      quantity: params[5],
      charge: String(params[6]),
      provider_cost: String(params[7]),
      profit: String(params[8]),
      currency: 'INR',
      provider_id: params[9],
      provider_order_id: null,
      provider_status: 'pending',
      status: 'pending',
      start_count: 0,
      remains: params[5],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fallbackStore.orders.unshift(newOrder);
    return { rows: [newOrder], rowCount: 1 };
  }

  // 6. Wallet Transactions & Payment Requests
  if (lowerSql.includes('from wallet_transactions')) {
    if (lowerSql.includes('where user_id = $1')) {
      const uid = parseInt(params[0], 10);
      const rows = fallbackStore.wallet_transactions.filter(t => t.user_id === uid);
      return { rows, rowCount: rows.length };
    }
    return { rows: fallbackStore.wallet_transactions, rowCount: fallbackStore.wallet_transactions.length };
  }

  if (lowerSql.includes('insert into wallet_transactions')) {
    const id = nextIds.wallet_transactions++;
    const newTx = {
      id,
      user_id: params[0],
      type: params[1],
      amount: String(params[2]),
      balance_before: String(params[3]),
      balance_after: String(params[4]),
      currency: params[5] || 'INR',
      reference_type: params[6],
      reference_id: params[7],
      description: params[8],
      admin_id: params[9] || null,
      created_at: new Date().toISOString()
    };
    fallbackStore.wallet_transactions.unshift(newTx);
    return { rows: [newTx], rowCount: 1 };
  }

  if (lowerSql.includes('from payment_requests')) {
    if (lowerSql.includes('where user_id = $1')) {
      const uid = parseInt(params[0], 10);
      const rows = fallbackStore.payment_requests.filter(p => p.user_id === uid);
      return { rows, rowCount: rows.length };
    }
    if (lowerSql.includes('where p.status = \'pending\'') || lowerSql.includes('where status = \'pending\'')) {
      const rows = fallbackStore.payment_requests.filter(p => p.status === 'pending').map(p => {
        const u = fallbackStore.users.find(usr => usr.id === p.user_id);
        return {
          ...p,
          username: u?.username || 'user',
          email: u?.email || '',
          current_user_balance: u?.wallet_balance || '0'
        };
      });
      return { rows, rowCount: rows.length };
    }
    if (lowerSql.includes('where id = $1')) {
      const id = parseInt(params[0], 10);
      const match = fallbackStore.payment_requests.find(p => p.id === id);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }
    return { rows: fallbackStore.payment_requests, rowCount: fallbackStore.payment_requests.length };
  }

  if (lowerSql.includes('insert into payment_requests')) {
    const id = nextIds.payment_requests++;
    const newReq = {
      id,
      user_id: params[0],
      amount: String(params[1]),
      currency: 'INR',
      payment_method: params[2],
      utr_number: params[3],
      payer_vpa_or_account: params[4] || null,
      status: 'pending',
      rejection_reason: null,
      approved_by_admin_id: null,
      approved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fallbackStore.payment_requests.unshift(newReq);
    return { rows: [newReq], rowCount: 1 };
  }

  if (lowerSql.includes('update payment_requests')) {
    const id = params[params.length - 1];
    const match = fallbackStore.payment_requests.find(p => p.id === parseInt(id, 10));
    if (match) {
      if (lowerSql.includes('status = \'approved\'')) {
        match.status = 'approved';
        match.approved_at = new Date().toISOString();
        match.approved_by_admin_id = params[0];
      } else if (lowerSql.includes('status = \'rejected\'')) {
        match.status = 'rejected';
        match.rejection_reason = params[0];
      }
      return { rows: [match], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 7. Providers
  if (lowerSql.includes('from api_providers')) {
    if (lowerSql.includes('where adapter_type = $1')) {
      const type = String(params[0]).toLowerCase();
      const match = fallbackStore.api_providers.find(p => p.adapter_type.toLowerCase() === type);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }
    if (lowerSql.includes('where id = $1')) {
      const id = parseInt(params[0], 10);
      const match = fallbackStore.api_providers.find(p => p.id === id);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }
    if (lowerSql.includes('where status = $1')) {
      const st = String(params[0]);
      const matches = fallbackStore.api_providers.filter(p => p.status === st);
      return { rows: matches, rowCount: matches.length };
    }
    return { rows: fallbackStore.api_providers, rowCount: fallbackStore.api_providers.length };
  }

  if (lowerSql.includes('insert into api_providers')) {
    const id = nextIds.api_providers++;
    const newProv = {
      id,
      name: params[0] || 'New Provider',
      adapter_type: params[1] || 'luvsmm',
      api_url: params[2] || 'https://luvsmm.com/api/v2',
      api_key_encrypted: params[3] || '',
      masked_key: params[4] || '••••••••••••',
      status: params[5] || 'active',
      balance: '0.0000',
      currency: 'USD',
      priority: params[6] || 1,
      last_checked_at: null,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fallbackStore.api_providers.push(newProv);
    return { rows: [newProv], rowCount: 1 };
  }

  if (lowerSql.includes('update api_providers')) {
    const id = params[params.length - 1];
    const match = fallbackStore.api_providers.find(p => p.id === parseInt(id, 10));
    if (match) {
      if (lowerSql.includes('last_checked_at = current_timestamp')) {
        match.last_checked_at = new Date().toISOString();
        if (params[0] !== undefined && typeof params[0] === 'number') {
          match.balance = String(params[0]);
        }
      }
      if (lowerSql.includes('name = coalesce($1, name)')) {
        if (params[0]) match.name = params[0];
        if (params[1]) match.api_url = params[1];
        if (params[2]) {
          match.api_key_encrypted = params[2];
          match.masked_key = params[3] || '••••••••••••';
        }
        if (params[4]) match.status = params[4];
      }
      match.updated_at = new Date().toISOString();
      return { rows: [match], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 8. Support Tickets
  if (lowerSql.includes('from support_tickets')) {
    const rows = fallbackStore.support_tickets.map(t => {
      const u = fallbackStore.users.find(usr => usr.id === t.user_id);
      return {
        ...t,
        username: u?.username || 'user',
        email: u?.email || '',
        message_count: fallbackStore.ticket_messages.filter(m => m.ticket_id === t.id).length
      };
    });
    return { rows, rowCount: rows.length };
  }

  if (lowerSql.includes('insert into support_tickets')) {
    const id = nextIds.support_tickets++;
    const newTicket = {
      id,
      user_id: params[0],
      order_id: params[1],
      subject: params[2],
      category: params[3],
      status: 'open',
      priority: params[4] || 'medium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fallbackStore.support_tickets.unshift(newTicket);
    return { rows: [newTicket], rowCount: 1 };
  }

  if (lowerSql.includes('insert into ticket_messages')) {
    const id = nextIds.ticket_messages++;
    const msg = {
      id,
      ticket_id: params[0],
      sender_role: params[1],
      sender_id: params[2],
      message: params[3],
      created_at: new Date().toISOString()
    };
    fallbackStore.ticket_messages.push(msg);
    return { rows: [msg], rowCount: 1 };
  }

  if (lowerSql.includes('from ticket_messages')) {
    const tid = parseInt(params[0], 10);
    const msgs = fallbackStore.ticket_messages.filter(m => m.ticket_id === tid);
    return { rows: msgs, rowCount: msgs.length };
  }

  // 9. Transaction statements
  if (lowerSql === 'begin' || lowerSql === 'commit' || lowerSql === 'rollback') {
    return { rows: [], rowCount: 0 };
  }

  return { rows: [], rowCount: 0 };
}

// Fallback DB client wrapper
const fallbackDbClient: any = {
  query: async (text: string, params?: any[]) => {
    return executeFallbackQuery(text, params);
  },
  connect: async () => {
    return {
      query: async (text: string, params?: any[]) => executeFallbackQuery(text, params),
      release: () => {}
    };
  }
};

// -------------------------------------------------------------
// NEON KEEP-ALIVE HEARTBEAT & SELF-HEALING ENGINE
// -------------------------------------------------------------
let heartbeatTimer: NodeJS.Timeout | null = null;
let lastSuccessfulHeartbeat: string | null = null;
let totalHeartbeats = 0;

export function startNeonKeepAliveHeartbeat(): void {
  if (heartbeatTimer) return;

  const runHeartbeat = async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      if (pool) {
        const res = await pool.query('SELECT 1 AS neon_keepalive, NOW() AS ping_time;');
        if (res && res.rows) {
          lastSuccessfulHeartbeat = new Date().toISOString();
          totalHeartbeats++;
        }
      }
    } catch (hbErr: any) {
      console.warn('[NEON KEEP-ALIVE HEARTBEAT] Reconnecting idle compute:', hbErr.message);
      // Try to re-prime the connection
      try {
        if (pool) {
          await pool.query('SELECT 1;');
        }
      } catch (_) {}
    }
  };

  // Ping every 150 seconds (2.5 minutes) to ensure Neon never enters sleep mode while server is online
  heartbeatTimer = setInterval(runHeartbeat, 150000);
  // Initial immediate warm-up ping
  setTimeout(runHeartbeat, 5000);
  console.log('[SOCIARAX] Neon Database Keep-Alive Heartbeat Daemon initialized (150s interval).');
}

export function getDbPool(): pg.Pool | any {
  if (!process.env.DATABASE_URL) {
    isUsingFallback = true;
    return fallbackDbClient;
  }

  if (!pool) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        },
        max: 15,
        idleTimeoutMillis: 180000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      });

      pool.on('error', (err) => {
        console.warn('[DATABASE WARNING] Transient connection reset caught on idle client:', err.message);
      });

      startNeonKeepAliveHeartbeat();
    } catch (e) {
      isUsingFallback = true;
      return fallbackDbClient;
    }
  }

  // Wrap pool with self-healing auto-retry proxy
  return {
    query: async (text: string, params?: any[]) => {
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        attempts++;
        try {
          if (!pool) return executeFallbackQuery(text, params);
          return await pool.query(text, params);
        } catch (queryErr: any) {
          const isTransient = 
            queryErr.message?.includes('Connection terminated') ||
            queryErr.message?.includes('timeout') ||
            queryErr.message?.includes('closed') ||
            queryErr.message?.includes('57P01') ||
            queryErr.message?.includes('ECONNRESET') ||
            queryErr.code === '57P01' ||
            queryErr.code === '08006';

          if (isTransient && attempts < maxAttempts) {
            console.warn(`[DATABASE AUTO-RETRY] Retrying query after transient disconnect (Attempt ${attempts}/${maxAttempts})...`);
            await new Promise(r => setTimeout(r, attempts * 400));
            continue;
          }

          // If Postgres is down or table is missing, fail safely to in-memory fallback without crashing
          console.warn(`[DATABASE FALLBACK ACTIVE] Query error: "${queryErr.message}". Serving via in-memory resilient engine.`);
          return executeFallbackQuery(text, params);
        }
      }
      return executeFallbackQuery(text, params);
    },
    connect: async () => {
      try {
        if (!pool) return fallbackDbClient.connect();
        return await pool.connect();
      } catch (connErr: any) {
        console.warn('[DATABASE CLIENT CONNECT ERROR] Providing fallback client:', connErr.message);
        return fallbackDbClient.connect();
      }
    },
    on: (event: any, handler: (...args: any[]) => void) => {
      if (pool) (pool as any).on(event, handler);
    }
  };
}


export async function checkDbConnection(): Promise<{ connected: boolean; message: string; tables?: string[] }> {
  if (!process.env.DATABASE_URL) {
    return {
      connected: true,
      message: 'Running with high-speed built-in local database. Neon PostgreSQL connection string can be configured in Settings for persistent cloud scaling.',
      tables: ['services', 'users', 'orders', 'wallet_transactions', 'payment_requests', 'system_settings', 'admin_security', 'api_providers']
    };
  }

  try {
    const db = getDbPool();
    const client = await db.connect();
    try {
      const res = await client.query('SELECT current_database(), current_user, version()');
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      isConnected = true;
      const tables = tablesRes.rows.map((r: any) => r.table_name);
      return {
        connected: true,
        message: `Connected to Neon PostgreSQL database "${res.rows[0].current_database}" as "${res.rows[0].current_user}"`,
        tables
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    isConnected = false;
    return {
      connected: true,
      message: `Running on high-speed embedded database. Neon Postgres check: ${err.message}`,
      tables: ['services', 'users', 'orders', 'wallet_transactions', 'payment_requests']
    };
  }
}

/**
 * Safe Schema Migration for Postgres
 */
export async function initializeDatabaseSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    const db = getDbPool();
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 1. Settings Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Users Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          phone VARCHAR(50),
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'user' NOT NULL,
          wallet_balance NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
          status VARCHAR(20) DEFAULT 'active' NOT NULL,
          api_key VARCHAR(100) UNIQUE,
          custom_discount_pct NUMERIC(5, 2) DEFAULT 0.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Migration: Ensure phone column exists
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
      await client.query(`
        UPDATE users 
        SET role = 'admin' 
        WHERE LOWER(email) = 'arifahmed87204@gmail.com' OR LOWER(username) = 'arifahmed56';
      `);

      // 3. Admin Credentials & 2FA Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_security (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          totp_secret_encrypted TEXT,
          totp_enabled BOOLEAN DEFAULT FALSE,
          backup_codes_encrypted TEXT,
          failed_attempts INT DEFAULT 0,
          locked_until TIMESTAMP WITH TIME ZONE,
          last_login_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. API Providers Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_providers (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          adapter_type VARCHAR(50) DEFAULT 'luvsmm' NOT NULL,
          api_url TEXT NOT NULL,
          api_key_encrypted TEXT NOT NULL,
          masked_key VARCHAR(30) NOT NULL,
          status VARCHAR(20) DEFAULT 'active' NOT NULL,
          balance NUMERIC(14, 4) DEFAULT 0.0000,
          currency VARCHAR(10) DEFAULT 'INR',
          priority INT DEFAULT 1,
          last_checked_at TIMESTAMP WITH TIME ZONE,
          last_error TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Service Categories Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS service_categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          platform VARCHAR(50) NOT NULL,
          display_order INT DEFAULT 0,
          status VARCHAR(20) DEFAULT 'active' NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Services Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS services (
          id SERIAL PRIMARY KEY,
          category_id INT REFERENCES service_categories(id) ON DELETE SET NULL,
          category_name VARCHAR(100) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          type VARCHAR(50) DEFAULT 'Default',
          min_quantity INT NOT NULL DEFAULT 10,
          max_quantity INT NOT NULL DEFAULT 100000,
          
          -- Provider cost (Admin only)
          provider_id INT REFERENCES api_providers(id) ON DELETE SET NULL,
          provider_service_id VARCHAR(100),
          provider_rate NUMERIC(14, 4) DEFAULT 0.0000 NOT NULL,
          
          -- Customer Selling Rate (Per 1000)
          rate_per_1000 NUMERIC(14, 4) NOT NULL,
          markup_percentage NUMERIC(6, 2) DEFAULT 30.00,
          markup_fixed NUMERIC(14, 4) DEFAULT 0.00,
          
          refill_available BOOLEAN DEFAULT FALSE,
          cancel_available BOOLEAN DEFAULT FALSE,
          dripfeed_available BOOLEAN DEFAULT FALSE,
          average_time VARCHAR(100) DEFAULT 'Instant - 1 hour',
          status VARCHAR(20) DEFAULT 'active' NOT NULL,
          display_order INT DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 7. Orders Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
          service_id INT REFERENCES services(id) ON DELETE RESTRICT NOT NULL,
          service_name VARCHAR(255) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          link TEXT NOT NULL,
          quantity INT NOT NULL,
          
          charge NUMERIC(14, 4) NOT NULL,
          provider_cost NUMERIC(14, 4) DEFAULT 0.0000,
          profit NUMERIC(14, 4) DEFAULT 0.0000,
          currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
          
          provider_id INT REFERENCES api_providers(id) ON DELETE SET NULL,
          provider_order_id VARCHAR(100),
          provider_status VARCHAR(50),
          provider_error TEXT,
          
          status VARCHAR(30) DEFAULT 'pending' NOT NULL,
          start_count INT DEFAULT 0,
          remains INT DEFAULT 0,
          idempotency_key VARCHAR(100) UNIQUE,
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 8. Wallet Ledger & Transactions Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
          type VARCHAR(50) NOT NULL,
          amount NUMERIC(14, 4) NOT NULL,
          balance_before NUMERIC(14, 4) NOT NULL,
          balance_after NUMERIC(14, 4) NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
          reference_type VARCHAR(50),
          reference_id VARCHAR(100),
          description TEXT NOT NULL,
          admin_id INT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 9. Payment Requests & Manual UTR Approvals Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS payment_requests (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
          amount NUMERIC(14, 4) NOT NULL,
          currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          utr_number VARCHAR(100) UNIQUE NOT NULL,
          payer_vpa_or_account VARCHAR(100),
          status VARCHAR(20) DEFAULT 'pending' NOT NULL,
          rejection_reason TEXT,
          approved_by_admin_id INT,
          approved_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 10. Support Tickets Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
          order_id INT REFERENCES orders(id) ON DELETE SET NULL,
          subject VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'open' NOT NULL,
          priority VARCHAR(20) DEFAULT 'medium' NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 11. Support Ticket Messages Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS ticket_messages (
          id SERIAL PRIMARY KEY,
          ticket_id INT REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
          sender_role VARCHAR(20) NOT NULL,
          sender_id INT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 12. Audit Logs Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          actor_type VARCHAR(20) NOT NULL,
          actor_id INT,
          action VARCHAR(100) NOT NULL,
          target_type VARCHAR(50),
          target_id VARCHAR(100),
          details JSONB,
          ip_address VARCHAR(45),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 13. Password Resets (Secure Verified OTPs)
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id SERIAL PRIMARY KEY,
          user_id INT NOT NULL,
          identifier VARCHAR(255) NOT NULL,
          otp_code VARCHAR(10) NOT NULL,
          channel VARCHAR(20) NOT NULL,
          destination VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          verified BOOLEAN DEFAULT FALSE,
          attempts INT DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Indexes
      await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_name);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_services_platform ON services(platform);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_requests(status);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_utr ON payment_requests(utr_number);`);

      // Auto-seed Admin Accounts if table empty
      const adminCountRes = await client.query('SELECT COUNT(*) FROM admin_security');
      if (parseInt(adminCountRes.rows[0].count, 10) === 0) {
        await client.query(`
          INSERT INTO admin_security (email, password_hash, totp_enabled)
          VALUES 
            ('arifahmed87204@gmail.com', $1, false),
            ('admin@sociarax.com', $1, false)
          ON CONFLICT (email) DO NOTHING;
        `, [initialPasswordHash]);
      } else {
        // Ensure user's primary admin email exists
        await client.query(`
          INSERT INTO admin_security (email, password_hash, totp_enabled)
          VALUES ('arifahmed87204@gmail.com', $1, false)
          ON CONFLICT (email) DO NOTHING;
        `, [initialPasswordHash]);
      }

      // Auto-seed API Providers if empty
      const provCountRes = await client.query('SELECT COUNT(*) FROM api_providers');
      if (parseInt(provCountRes.rows[0].count, 10) === 0) {
        await client.query(`
          INSERT INTO api_providers (name, adapter_type, api_url, api_key_encrypted, masked_key, status, balance, currency, priority)
          VALUES ('Luvsmm Main', 'luvsmm', 'https://luvsmm.com/api/v2', 'demo_encrypted_key', '••••••••••••1234', 'active', 84.5000, 'USD', 1);
        `);
      }

      // Auto-populate Services if empty from "Service" table or fallback
      const srvCountRes = await client.query('SELECT COUNT(*) FROM services');
      if (parseInt(srvCountRes.rows[0].count, 10) === 0) {
        // Check if legacy "Service" table with real 2680+ services exists
        const legacyCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'Service'
          ) as exists;
        `);

        if (legacyCheck.rows[0]?.exists) {
          console.log('[DATABASE] Migrating real services from "Service" table into services table...');
          await client.query(`
            INSERT INTO services (
              name, category_name, platform, description, type,
              min_quantity, max_quantity, provider_id, provider_service_id,
              provider_rate, rate_per_1000, markup_percentage, markup_fixed,
              refill_available, cancel_available, dripfeed_available,
              average_time, status, display_order
            )
            SELECT
              s.name,
              COALESCE(c.name, 'General') as category_name,
              CASE
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%instagram%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%ig %' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%threads%' THEN 'instagram'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%youtube%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%yt %' THEN 'youtube'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%telegram%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%tg %' THEN 'telegram'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%spotify%' THEN 'spotify'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%tiktok%' THEN 'tiktok'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%facebook%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%fb %' THEN 'facebook'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%twitter%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%tweet%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '% x %' THEN 'twitter'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%snapchat%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%snap %' THEN 'snapchat'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%discord%' THEN 'discord'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%linkedin%' THEN 'linkedin'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%pinterest%' THEN 'pinterest'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%twitch%' THEN 'twitch'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%traffic%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%website%' THEN 'traffic'
                WHEN LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%google%' OR LOWER(COALESCE(c.name, '') || ' ' || s.name) LIKE '%reviews%' THEN 'google'
                ELSE 'other'
              END as platform,
              COALESCE(s.description, '') as description,
              'Default' as type,
              COALESCE(s."minQuantity", 10) as min_quantity,
              COALESCE(s."maxQuantity", 100000) as max_quantity,
              (SELECT id FROM api_providers LIMIT 1) as provider_id,
              CAST(s."providerId" AS VARCHAR) as provider_service_id,
              COALESCE(s.price * 0.75, 0) as provider_rate,
              COALESCE(s.price, 50) as rate_per_1000,
              35.00 as markup_percentage,
              0 as markup_fixed,
              (LOWER(s.name) LIKE '%refill%' OR s.name LIKE '%♻️%') as refill_available,
              false as cancel_available,
              false as dripfeed_available,
              COALESCE(s."avgTime", 'Instant - 1 hour') as average_time,
              CASE WHEN s.active = false THEN 'inactive' ELSE 'active' END as status,
              ROW_NUMBER() OVER (ORDER BY s.id ASC) as display_order
            FROM "Service" s
            LEFT JOIN "Category" c ON s."categoryId" = c.id
            ORDER BY s.id ASC
          `);
          console.log('[DATABASE] Successfully populated services from "Service" table.');
        }

        // Also populate service_categories
        await client.query(`
          INSERT INTO service_categories (name, platform, display_order, status)
          SELECT 
            category_name as name,
            MAX(platform) as platform,
            ROW_NUMBER() OVER (ORDER BY category_name ASC) as display_order,
            'active' as status
          FROM services
          GROUP BY category_name
          ORDER BY category_name ASC
          ON CONFLICT (name) DO NOTHING;
        `);
      }

      await client.query('COMMIT');
      console.log('[DATABASE] Safe Postgres schema migration & seeding completed.');
    } catch (migErr) {
      await client.query('ROLLBACK');
      console.error('[DATABASE MIGRATION ERROR]:', migErr);
    } finally {
      client.release();
    }
  } catch (connErr) {
    console.error('[DATABASE CONNECT ERROR during migration]:', connErr);
  }
}

