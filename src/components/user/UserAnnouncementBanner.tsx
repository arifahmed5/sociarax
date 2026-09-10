import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, X, Globe } from 'lucide-react';

interface ActiveBannerData {
  id: number;
  imageUrl: string | null;
  targetUrl: string | null;
  durationHours: number;
  publishedAt: string;
  expiresAt: string;
  secondsRemaining: number;
}

export const UserAnnouncementBanner: React.FC = () => {
  const [banner, setBanner] = useState<ActiveBannerData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fetch active banner from backend
  const fetchActiveBanner = useCallback(async () => {
    try {
      const res = await fetch('/api/banner/active', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) {
        setBanner(null);
        return;
      }
      const data = await res.json();
      if (data && data.success && data.banner) {
        // Check if user previously dismissed this specific banner during this session
        const dismissedKey = `sociarax_banner_dismissed_${data.banner.id}`;
        if (sessionStorage.getItem(dismissedKey) === 'true') {
          setIsDismissed(true);
        } else {
          setIsDismissed(false);
        }
        setBanner(data.banner);
      } else {
        setBanner(null);
      }
    } catch (err) {
      // Graceful failure - never throw or show broken UI
      setBanner(null);
    }
  }, []);

  useEffect(() => {
    fetchActiveBanner();

    // Re-check when admin publishes/deletes or window regains focus
    const handleUpdate = () => fetchActiveBanner();
    window.addEventListener('sociarax_banner_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);

    return () => {
      window.removeEventListener('sociarax_banner_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [fetchActiveBanner]);

  // Client countdown to auto-expire banner the moment time runs out
  useEffect(() => {
    if (!banner || banner.secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setBanner(prev => {
        if (!prev) return null;
        const nextSecs = prev.secondsRemaining - 1;
        if (nextSecs <= 0) {
          return null; // Expired: disappear immediately
        }
        return { ...prev, secondsRemaining: nextSecs };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [banner?.id, banner?.secondsRemaining]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (banner) {
      sessionStorage.setItem(`sociarax_banner_dismissed_${banner.id}`, 'true');
    }
    setIsDismissed(true);
  };

  // IF NO BANNER OR DISMISSED: RENDER ABSOLUTELY NOTHING
  // ZERO blank space, ZERO height, ZERO layout shift
  if (!banner || isDismissed) {
    return null;
  }

  const hasImage = Boolean(banner.imageUrl && banner.imageUrl.trim() !== '');
  const hasUrl = Boolean(banner.targetUrl && banner.targetUrl.trim() !== '');

  // If banner specifies an image but loading failed: hide completely
  if (hasImage && imageError) {
    return null;
  }

  // If neither image nor URL exists: render nothing
  if (!hasImage && !hasUrl) {
    return null;
  }

  // Helper to extract clean domain for URL-only banner
  const getDisplayDomain = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return urlStr;
    }
  };

  // -------------------------------------------------------------
  // MODE 2: URL ONLY (Clean, compact announcement bar - no broken image)
  // -------------------------------------------------------------
  if (!hasImage && hasUrl) {
    return (
      <div className="w-full mb-5 sm:mb-6 animate-fadeIn">
        <div className="relative group flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 hover:border-indigo-400/60 shadow-lg shadow-indigo-950/20 backdrop-blur-md transition-all">
          <a
            href={banner.targetUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 min-w-0 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:text-indigo-300 transition-all shrink-0">
              <Globe className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-200 transition-colors truncate">
                  {getDisplayDomain(banner.targetUrl!)}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Announcement
                </span>
              </div>
              <p className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors truncate">
                {banner.targetUrl}
              </p>
            </div>
          </a>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={banner.targetUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              <span>Open Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50 transition-colors cursor-pointer"
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MODE 1 & 3: IMAGE ONLY or IMAGE + URL
  // -------------------------------------------------------------
  const isClickable = hasUrl;

  const bannerContent = (
    <div className="relative w-full overflow-hidden rounded-2xl border border-indigo-500/20 bg-slate-900/60 shadow-xl backdrop-blur-sm group">
      {/* Banner Image */}
      <img
        src={banner.imageUrl!}
        alt="Announcement Banner"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        className={`w-full max-h-48 sm:max-h-60 md:max-h-72 object-cover object-center transition-all duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        } ${isClickable ? 'group-hover:scale-[1.01] group-hover:brightness-105' : ''}`}
      />

      {/* Clickable Overlay Indicator Badge (if link present) */}
      {isClickable && (
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-white/20 text-white text-xs font-semibold shadow-lg backdrop-blur-md opacity-90 group-hover:opacity-100 transition-opacity">
          <span>Visit Link</span>
          <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
        </div>
      )}

      {/* Session Dismiss Button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 p-1.5 rounded-full bg-slate-950/70 hover:bg-slate-900 text-slate-300 hover:text-white border border-white/10 shadow-md backdrop-blur-md transition-all cursor-pointer"
        title="Dismiss banner"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="w-full mb-5 sm:mb-6 animate-fadeIn">
      {isClickable ? (
        <a
          href={banner.targetUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="block cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-2xl"
        >
          {bannerContent}
        </a>
      ) : (
        bannerContent
      )}
    </div>
  );
};
