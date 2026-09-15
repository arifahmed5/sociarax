import React from 'react';
import { PlatformType, OrderStatus } from '../types';
import { 
  Instagram, 
  Youtube, 
  Facebook, 
  Send, 
  Twitter, 
  Music, 
  Globe, 
  Ghost,
  MessageSquare,
  MessageCircle,
  Linkedin,
  Tv,
  CheckCircle2, 
  Clock, 
  Loader2, 
  AlertCircle, 
  RotateCcw,
  XCircle
} from 'lucide-react';

/**
 * Robust platform detection engine that inspects category, service name, and raw platform metadata.
 * Prioritizes service category over secondary mention tags in the name (e.g. "YouTube Shares from Facebook" is YouTube).
 */
export function resolvePlatform(input?: any): PlatformType {
  if (!input) return 'other';
  let rawCategory = '';
  let rawName = '';
  let rawPlatform = '';

  if (typeof input === 'string') {
    rawCategory = input;
    rawPlatform = input;
  } else if (typeof input === 'object') {
    rawCategory = input.category || input.category_name || '';
    rawName = input.name || input.serviceName || input.service_name || '';
    rawPlatform = input.platform || '';
  }

  const cat = rawCategory.normalize('NFKD').toLowerCase().replace(/&amp;/g, '&');
  const name = rawName.normalize('NFKD').toLowerCase().replace(/&amp;/g, '&');
  const p = rawPlatform.normalize('NFKD').toLowerCase();

  const matchPlatformText = (text: string): PlatformType | null => {
    if (!text) return null;
    if (text.includes('youtube') || text.includes('yt ') || text.includes('yt_') || text.includes('yt-') || text.includes('youtub')) return 'youtube';
    if (text.includes('facebook') || text.includes('fb ') || text.includes('fb_') || text.includes('fb-') || text.includes('📘facebook') || text.includes('fbpage') || text.includes('facebook:')) return 'facebook';
    if (text.includes('instagram') || text.includes('insta') || text.includes('ig ') || text.includes('ig_') || text.includes('threads')) return 'instagram';
    if (text.includes('telegram') || text.includes('tg ') || text.includes('tg_') || text.includes('tg-') || text.includes('tele ')) return 'telegram';
    if (text.includes('twitter') || text.includes('tweet') || text.includes('𝕏') || text.includes('x -') || text.includes('x-') || text.includes(' x ') || text.startsWith('x ') || text.includes('x.com')) return 'twitter';
    if (text.includes('tiktok') || text.includes('tik tok') || text.includes('tik-tok') || text.includes('tikto') || text.includes('tt ')) return 'tiktok';
    if (text.includes('snapchat') || text.includes('snap ') || text.includes('snap-') || text.includes('snapscore') || text.includes('spotlight')) return 'snapchat';
    if (text.includes('spotify') || text.includes('podcast')) return 'spotify';
    if (text.includes('discord')) return 'discord';
    if (text.includes('traffic') || text.includes('website visitor') || text.includes('web traffic') || text.includes('website geo') || text.includes('website')) return 'traffic';
    if (text.includes('whatsapp')) return 'whatsapp';
    if (text.includes('linkedin')) return 'linkedin';
    if (text.includes('pinterest')) return 'pinterest';
    if (text.includes('twitch')) return 'twitch';
    if (text.includes('reddit')) return 'reddit';
    if (text.includes('google') || text.includes('play store')) return 'google';
    return null;
  };

  // 1. First priority: Check category (category accurately identifies provider catalog section)
  const fromCat = matchPlatformText(cat);
  if (fromCat) return fromCat;

  // 2. Second priority: Check name
  const fromName = matchPlatformText(name);
  if (fromName) return fromName;

  // 3. Third priority: Check platform field if it matches a known platform
  const fromP = matchPlatformText(p);
  if (fromP) return fromP;

  if (p && p !== 'other' && p !== 'all') {
    return p as PlatformType;
  }

  return 'other';
}

export function getPlatformMeta(platform: PlatformType | string) {
  const p = (platform || '').toLowerCase().trim();

  switch (p) {
    case 'facebook':
      return {
        label: 'Facebook',
        icon: Facebook,
        bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
      };
    case 'instagram':
      return {
        label: 'Instagram',
        icon: Instagram,
        bg: 'bg-pink-500/15 text-pink-400 border-pink-500/30'
      };
    case 'youtube':
      return {
        label: 'YouTube',
        icon: Youtube,
        bg: 'bg-red-500/15 text-red-400 border-red-500/30'
      };
    case 'telegram':
      return {
        label: 'Telegram',
        icon: Send,
        bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
      };
    case 'twitter':
      return {
        label: 'Twitter / X',
        icon: Twitter,
        bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30'
      };
    case 'snapchat':
      return {
        label: 'Snapchat',
        icon: Ghost,
        bg: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
      };
    case 'tiktok':
      return {
        label: 'TikTok',
        icon: Music,
        bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      };
    case 'spotify':
      return {
        label: 'Spotify',
        icon: Music,
        bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      };
    case 'discord':
      return {
        label: 'Discord',
        icon: MessageSquare,
        bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
      };
    case 'traffic':
      return {
        label: 'Website Traffic',
        icon: Globe,
        bg: 'bg-teal-500/15 text-teal-400 border-teal-500/30'
      };
    case 'whatsapp':
      return {
        label: 'WhatsApp',
        icon: MessageCircle,
        bg: 'bg-green-500/15 text-green-400 border-green-500/30'
      };
    case 'linkedin':
      return {
        label: 'LinkedIn',
        icon: Linkedin,
        bg: 'bg-blue-600/15 text-blue-300 border-blue-600/30'
      };
    case 'pinterest':
      return {
        label: 'Pinterest',
        icon: Globe,
        bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };
    case 'twitch':
      return {
        label: 'Twitch',
        icon: Tv,
        bg: 'bg-purple-600/15 text-purple-300 border-purple-600/30'
      };
    case 'reddit':
      return {
        label: 'Reddit',
        icon: MessageCircle,
        bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30'
      };
    case 'google':
      return {
        label: 'Google',
        icon: Globe,
        bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      };
    default:
      return {
        label: platform || 'Other',
        icon: Globe,
        bg: 'bg-slate-800 text-slate-300 border-slate-700'
      };
  }
}

export const PlatformBadge: React.FC<{ 
  platform?: PlatformType | string; 
  service?: { name?: string; category?: string; platform?: PlatformType | string } | null;
  category?: string;
  name?: string;
  showIcon?: boolean; 
  size?: 'sm' | 'md';
  className?: string;
}> = ({ 
  platform, 
  service,
  category,
  name,
  showIcon = true,
  size = 'md',
  className = ''
}) => {
  const resolved = resolvePlatform(service || { platform, category, name });
  const meta = getPlatformMeta(resolved);
  const Icon = meta.icon;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-lg border ${meta.bg} ${padding} ${className}`}>
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{meta.label}</span>
    </span>
  );
};

export const StatusBadge: React.FC<{ status: OrderStatus | string; size?: 'sm' | 'md' }> = ({ 
  status,
  size = 'md' 
}) => {
  const s = (status || '').toLowerCase();

  let bg = 'bg-slate-800 text-slate-300 border-slate-700';
  let Icon = Clock;
  let label = status;

  if (s === 'completed') {
    bg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    Icon = CheckCircle2;
    label = 'Completed';
  } else if (s === 'in_progress' || s === 'processing') {
    bg = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    Icon = Loader2;
    label = s === 'processing' ? 'Processing' : 'In Progress';
  } else if (s === 'pending') {
    bg = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    Icon = Clock;
    label = 'Pending';
  } else if (s === 'partial') {
    bg = 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    Icon = AlertCircle;
    label = 'Partial';
  } else if (s === 'canceled' || s === 'cancelled' || s === 'failed') {
    bg = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    Icon = XCircle;
    label = s === 'failed' ? 'Failed' : 'Canceled';
  } else if (s === 'refunded') {
    bg = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    Icon = RotateCcw;
    label = 'Refunded';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-lg border capitalize ${bg} ${padding}`}>
      <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${s === 'processing' ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </span>
  );
};
