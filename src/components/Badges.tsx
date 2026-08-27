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
  CheckCircle2, 
  Clock, 
  Loader2, 
  AlertCircle, 
  RotateCcw,
  XCircle
} from 'lucide-react';

export const PlatformBadge: React.FC<{ platform: PlatformType; showIcon?: boolean; size?: 'sm' | 'md' }> = ({ 
  platform, 
  showIcon = true,
  size = 'md' 
}) => {
  const p = (platform || '').toLowerCase();
  
  let bg = 'bg-slate-800 text-slate-300 border-slate-700';
  let Icon = Globe;
  let label = platform || 'Other';

  if (p.includes('insta')) {
    bg = 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    Icon = Instagram;
    label = 'Instagram';
  } else if (p.includes('youtube') || p.includes('yt')) {
    bg = 'bg-red-500/15 text-red-400 border-red-500/30';
    Icon = Youtube;
    label = 'YouTube';
  } else if (p.includes('face') || p.includes('fb')) {
    bg = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    Icon = Facebook;
    label = 'Facebook';
  } else if (p.includes('tele') || p.includes('tg')) {
    bg = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    Icon = Send;
    label = 'Telegram';
  } else if (p.includes('twit') || p.includes('x')) {
    bg = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    Icon = Twitter;
    label = 'Twitter / X';
  } else if (p.includes('snap')) {
    bg = 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    Icon = Ghost;
    label = 'Snapchat';
  } else if (p.includes('tik')) {
    bg = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    Icon = Music;
    label = 'TikTok';
  } else if (p.includes('spot')) {
    bg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    Icon = Music;
    label = 'Spotify';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-lg border ${bg} ${padding}`}>
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{label}</span>
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
