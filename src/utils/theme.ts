import { WebsiteMaintenanceConfig, ThemeColorName, ButtonStyleName } from '../types';

export interface ThemeClasses {
  // Backgrounds & Gradients
  primaryBg: string;
  primaryHoverBg: string;
  primaryActiveBg: string;
  primaryGradient: string;
  brandGradient: string;
  primaryGlow: string;
  brandGlow: string;
  heroGradient: string;
  
  // Text colors
  primaryText: string;
  primaryLightText: string;
  primaryDarkText: string;
  
  // Borders & Rings
  primaryBorder: string;
  cardBorder: string;
  primaryBorderHover: string;
  primaryRing: string;
  
  // Badges & Pills
  primaryBadge: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  
  // Tab classes
  activeTabBg: string;
  activeTabText: string;
  activeTabBorder: string;

  // Buttons
  primaryButton: string;
  
  // Shadows
  primaryShadow: string;
  
  // Accent highlights
  selectionClass: string;
}

export const THEME_PALETTES: Record<ThemeColorName, ThemeClasses> = {
  indigo: {
    primaryBg: 'bg-indigo-600',
    primaryHoverBg: 'hover:bg-indigo-500',
    primaryActiveBg: 'active:bg-indigo-700',
    primaryGradient: 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600',
    brandGradient: 'from-indigo-600 via-indigo-500 to-purple-600',
    primaryGlow: 'bg-indigo-500/15',
    brandGlow: 'shadow-indigo-600/30',
    heroGradient: 'from-indigo-400 via-purple-400 to-pink-400',
    primaryText: 'text-indigo-400',
    primaryLightText: 'text-indigo-300',
    primaryDarkText: 'text-indigo-900',
    primaryBorder: 'border-indigo-500/30',
    cardBorder: 'border-indigo-500/30',
    primaryBorderHover: 'hover:border-indigo-500/60',
    primaryRing: 'focus:ring-indigo-500 focus:border-indigo-500',
    primaryBadge: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
    activeTabBg: 'bg-indigo-600/20',
    activeTabText: 'text-indigo-300',
    activeTabBorder: 'border-indigo-500/30',
    primaryButton: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30',
    primaryShadow: 'shadow-indigo-600/30',
    selectionClass: 'selection:bg-indigo-500 selection:text-white',
  },
  emerald: {
    primaryBg: 'bg-emerald-600',
    primaryHoverBg: 'hover:bg-emerald-500',
    primaryActiveBg: 'active:bg-emerald-700',
    primaryGradient: 'bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600',
    brandGradient: 'from-emerald-600 via-teal-500 to-cyan-600',
    primaryGlow: 'bg-emerald-500/15',
    brandGlow: 'shadow-emerald-600/30',
    heroGradient: 'from-emerald-400 via-teal-300 to-cyan-400',
    primaryText: 'text-emerald-400',
    primaryLightText: 'text-emerald-300',
    primaryDarkText: 'text-emerald-900',
    primaryBorder: 'border-emerald-500/30',
    cardBorder: 'border-emerald-500/30',
    primaryBorderHover: 'hover:border-emerald-500/60',
    primaryRing: 'focus:ring-emerald-500 focus:border-emerald-500',
    primaryBadge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
    activeTabBg: 'bg-emerald-600/20',
    activeTabText: 'text-emerald-300',
    activeTabBorder: 'border-emerald-500/30',
    primaryButton: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30',
    primaryShadow: 'shadow-emerald-600/30',
    selectionClass: 'selection:bg-emerald-500 selection:text-white',
  },
  purple: {
    primaryBg: 'bg-purple-600',
    primaryHoverBg: 'hover:bg-purple-500',
    primaryActiveBg: 'active:bg-purple-700',
    primaryGradient: 'bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600',
    brandGradient: 'from-purple-600 via-purple-500 to-indigo-600',
    primaryGlow: 'bg-purple-500/15',
    brandGlow: 'shadow-purple-600/30',
    heroGradient: 'from-purple-400 via-fuchsia-400 to-indigo-400',
    primaryText: 'text-purple-400',
    primaryLightText: 'text-purple-300',
    primaryDarkText: 'text-purple-900',
    primaryBorder: 'border-purple-500/30',
    cardBorder: 'border-purple-500/30',
    primaryBorderHover: 'hover:border-purple-500/60',
    primaryRing: 'focus:ring-purple-500 focus:border-purple-500',
    primaryBadge: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-300',
    badgeBorder: 'border-purple-500/30',
    activeTabBg: 'bg-purple-600/20',
    activeTabText: 'text-purple-300',
    activeTabBorder: 'border-purple-500/30',
    primaryButton: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30',
    primaryShadow: 'shadow-purple-600/30',
    selectionClass: 'selection:bg-purple-500 selection:text-white',
  },
  blue: {
    primaryBg: 'bg-blue-600',
    primaryHoverBg: 'hover:bg-blue-500',
    primaryActiveBg: 'active:bg-blue-700',
    primaryGradient: 'bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600',
    brandGradient: 'from-blue-600 via-sky-500 to-indigo-600',
    primaryGlow: 'bg-blue-500/15',
    brandGlow: 'shadow-blue-600/30',
    heroGradient: 'from-blue-400 via-sky-300 to-cyan-400',
    primaryText: 'text-blue-400',
    primaryLightText: 'text-blue-300',
    primaryDarkText: 'text-blue-900',
    primaryBorder: 'border-blue-500/30',
    cardBorder: 'border-blue-500/30',
    primaryBorderHover: 'hover:border-blue-500/60',
    primaryRing: 'focus:ring-blue-500 focus:border-blue-500',
    primaryBadge: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-300',
    badgeBorder: 'border-blue-500/30',
    activeTabBg: 'bg-blue-600/20',
    activeTabText: 'text-blue-300',
    activeTabBorder: 'border-blue-500/30',
    primaryButton: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30',
    primaryShadow: 'shadow-blue-600/30',
    selectionClass: 'selection:bg-blue-500 selection:text-white',
  },
  rose: {
    primaryBg: 'bg-rose-600',
    primaryHoverBg: 'hover:bg-rose-500',
    primaryActiveBg: 'active:bg-rose-700',
    primaryGradient: 'bg-gradient-to-r from-rose-600 via-pink-500 to-purple-600',
    brandGradient: 'from-rose-600 via-pink-500 to-purple-600',
    primaryGlow: 'bg-rose-500/15',
    brandGlow: 'shadow-rose-600/30',
    heroGradient: 'from-rose-400 via-pink-400 to-amber-300',
    primaryText: 'text-rose-400',
    primaryLightText: 'text-rose-300',
    primaryDarkText: 'text-rose-900',
    primaryBorder: 'border-rose-500/30',
    cardBorder: 'border-rose-500/30',
    primaryBorderHover: 'hover:border-rose-500/60',
    primaryRing: 'focus:ring-rose-500 focus:border-rose-500',
    primaryBadge: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-500/30',
    activeTabBg: 'bg-rose-600/20',
    activeTabText: 'text-rose-300',
    activeTabBorder: 'border-rose-500/30',
    primaryButton: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
    primaryShadow: 'shadow-rose-600/30',
    selectionClass: 'selection:bg-rose-500 selection:text-white',
  },
  amber: {
    primaryBg: 'bg-amber-600',
    primaryHoverBg: 'hover:bg-amber-500',
    primaryActiveBg: 'active:bg-amber-700',
    primaryGradient: 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600',
    brandGradient: 'from-amber-500 via-orange-500 to-yellow-600',
    primaryGlow: 'bg-amber-500/15',
    brandGlow: 'shadow-amber-600/30',
    heroGradient: 'from-amber-300 via-orange-400 to-yellow-300',
    primaryText: 'text-amber-400',
    primaryLightText: 'text-amber-300',
    primaryDarkText: 'text-amber-900',
    primaryBorder: 'border-amber-500/30',
    cardBorder: 'border-amber-500/30',
    primaryBorderHover: 'hover:border-amber-500/60',
    primaryRing: 'focus:ring-amber-500 focus:border-amber-500',
    primaryBadge: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/30',
    activeTabBg: 'bg-amber-600/20',
    activeTabText: 'text-amber-300',
    activeTabBorder: 'border-amber-500/30',
    primaryButton: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30',
    primaryShadow: 'shadow-amber-600/30',
    selectionClass: 'selection:bg-amber-500 selection:text-white',
  },
  cyan: {
    primaryBg: 'bg-cyan-600',
    primaryHoverBg: 'hover:bg-cyan-500',
    primaryActiveBg: 'active:bg-cyan-700',
    primaryGradient: 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600',
    brandGradient: 'from-cyan-500 via-teal-500 to-blue-600',
    primaryGlow: 'bg-cyan-500/15',
    brandGlow: 'shadow-cyan-600/30',
    heroGradient: 'from-cyan-300 via-teal-300 to-blue-400',
    primaryText: 'text-cyan-400',
    primaryLightText: 'text-cyan-300',
    primaryDarkText: 'text-cyan-900',
    primaryBorder: 'border-cyan-500/30',
    cardBorder: 'border-cyan-500/30',
    primaryBorderHover: 'hover:border-cyan-500/60',
    primaryRing: 'focus:ring-cyan-500 focus:border-cyan-500',
    primaryBadge: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-500/30',
    activeTabBg: 'bg-cyan-600/20',
    activeTabText: 'text-cyan-300',
    activeTabBorder: 'border-cyan-500/30',
    primaryButton: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30',
    primaryShadow: 'shadow-cyan-600/30',
    selectionClass: 'selection:bg-cyan-500 selection:text-white',
  },
  violet: {
    primaryBg: 'bg-violet-600',
    primaryHoverBg: 'hover:bg-violet-500',
    primaryActiveBg: 'active:bg-violet-700',
    primaryGradient: 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600',
    brandGradient: 'from-violet-600 via-purple-600 to-indigo-600',
    primaryGlow: 'bg-violet-500/15',
    brandGlow: 'shadow-violet-600/30',
    heroGradient: 'from-violet-400 via-purple-300 to-indigo-400',
    primaryText: 'text-violet-400',
    primaryLightText: 'text-violet-300',
    primaryDarkText: 'text-violet-900',
    primaryBorder: 'border-violet-500/30',
    cardBorder: 'border-violet-500/30',
    primaryBorderHover: 'hover:border-violet-500/60',
    primaryRing: 'focus:ring-violet-500 focus:border-violet-500',
    primaryBadge: 'bg-violet-500/10 border-violet-500/30 text-violet-300',
    badgeBg: 'bg-violet-500/10',
    badgeText: 'text-violet-300',
    badgeBorder: 'border-violet-500/30',
    activeTabBg: 'bg-violet-600/20',
    activeTabText: 'text-violet-300',
    activeTabBorder: 'border-violet-500/30',
    primaryButton: 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30',
    primaryShadow: 'shadow-violet-600/30',
    selectionClass: 'selection:bg-violet-500 selection:text-white',
  }
};

export const BUTTON_RADIUS_MAP: Record<ButtonStyleName, string> = {
  'rounded-full': 'rounded-full',
  'rounded-2xl': 'rounded-2xl',
  'rounded-xl': 'rounded-xl',
  'rounded-lg': 'rounded-lg'
};

export function getTheme(config?: Partial<WebsiteMaintenanceConfig> | null): ThemeClasses {
  const color = (config?.themeColor || 'indigo') as ThemeColorName;
  return THEME_PALETTES[color] || THEME_PALETTES.indigo;
}

export function getButtonRadius(config?: Partial<WebsiteMaintenanceConfig> | null): string {
  const style = (config?.buttonStyle || 'rounded-xl') as ButtonStyleName;
  return BUTTON_RADIUS_MAP[style] || 'rounded-xl';
}
