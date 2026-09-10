import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Megaphone, 
  Upload, 
  Link as LinkIcon, 
  Clock, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Globe,
  X
} from 'lucide-react';

interface BannerData {
  id: number;
  imageUrl: string | null;
  targetUrl: string | null;
  durationHours: number;
  publishedAt: string;
  expiresAt: string;
  secondsRemaining: number;
}

export const AdminBannerManager: React.FC = () => {
  const { adminToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active banner state
  const [activeBanner, setActiveBanner] = useState<BannerData | null>(null);
  const [isLoadingBanner, setIsLoadingBanner] = useState(false);

  // Form state
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const getAuthHeader = () => {
    const token = adminToken || localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_user_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Fetch current active banner
  const fetchCurrentBanner = async () => {
    setIsLoadingBanner(true);
    try {
      const res = await fetch('/api/admin/banner/current', {
        headers: {
          ...getAuthHeader(),
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.banner) {
          setActiveBanner(data.banner);
        } else {
          setActiveBanner(null);
        }
      } else {
        setActiveBanner(null);
      }
    } catch (e) {
      setActiveBanner(null);
    } finally {
      setIsLoadingBanner(false);
    }
  };

  useEffect(() => {
    fetchCurrentBanner();
  }, [adminToken]);

  // Live countdown timer for active banner display
  useEffect(() => {
    if (!activeBanner || activeBanner.secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setActiveBanner(prev => {
        if (!prev) return null;
        const nextSecs = prev.secondsRemaining - 1;
        if (nextSecs <= 0) {
          return null; // Expired
        }
        return { ...prev, secondsRemaining: nextSecs };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBanner?.id, activeBanner?.secondsRemaining]);

  // Format remaining seconds into Human Readable String
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m remaining`;
    }
    return `${mins}m ${secs}s remaining`;
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'File size exceeds 5MB limit.' });
      return;
    }

    setIsUploading(true);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch('/api/admin/banner/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          credentials: 'include',
          body: JSON.stringify({
            fileBase64: base64,
            filename: file.name,
            mimeType: file.type
          })
        });

        const data = await res.json();
        if (res.ok && data.success && data.imageUrl) {
          setImageUrl(data.imageUrl);
          setFeedback({ type: 'success', message: 'Image uploaded successfully!' });
        } else {
          setFeedback({ type: 'error', message: data.error || 'Failed to upload image.' });
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Upload request failed.' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      setFeedback({ type: 'error', message: 'Could not read selected file.' });
    };
    reader.readAsDataURL(file);
  };

  // Handle Publish / Update Banner (Supports Image-Only, URL-Only, and Image+URL)
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedImg = imageUrl.trim();
    const trimmedUrl = targetUrl.trim();

    // Require at least one of image or URL
    if (!trimmedImg && !trimmedUrl) {
      setFeedback({ type: 'error', message: 'Please upload an image or enter a website URL.' });
      return;
    }

    // Safety check for dangerous URL schemes on client-side
    if (trimmedUrl) {
      const lower = trimmedUrl.toLowerCase();
      if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')
      ) {
        setFeedback({ type: 'error', message: 'Unsafe or dangerous URL protocol is not allowed.' });
        return;
      }
    }

    setIsPublishing(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/banner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify({
          imageUrl: trimmedImg || undefined,
          targetUrl: trimmedUrl || undefined,
          durationHours: Math.min(Math.max(1, durationHours), 24)
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.banner) {
        setActiveBanner(data.banner);
        setFeedback({ type: 'success', message: data.message || 'Banner published successfully!' });
        // Clear input form
        setImageUrl('');
        setTargetUrl('');
        setDurationHours(24);
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Notify user banner component in realtime
        window.dispatchEvent(new Event('sociarax_banner_updated'));
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to publish banner.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Publish request failed.' });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Delete / Deactivate Banner (No window.confirm to prevent iframe blocking)
  const handleDelete = async () => {
    setIsDeleting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/banner', {
        method: 'DELETE',
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActiveBanner(null);
        setImageUrl('');
        setTargetUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFeedback({ type: 'success', message: 'Banner removed successfully. You can now publish a new banner.' });
        window.dispatchEvent(new Event('sociarax_banner_updated'));
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to remove banner.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Delete request failed.' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle removing ONLY the URL link from an active image+URL banner
  const handleRemoveLinkOnly = async () => {
    if (!activeBanner || !activeBanner.imageUrl) return;
    setIsDeleting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/banner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify({
          imageUrl: activeBanner.imageUrl,
          targetUrl: '',
          durationHours: Math.min(24, Math.max(1, Math.round(activeBanner.secondsRemaining / 3600)) || 24)
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.banner) {
        setActiveBanner(data.banner);
        setFeedback({ type: 'success', message: 'URL link removed from banner!' });
        window.dispatchEvent(new Event('sociarax_banner_updated'));
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to remove link.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove link.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveImage = Boolean(activeBanner?.imageUrl && activeBanner.imageUrl.trim() !== '');
  const hasActiveUrl = Boolean(activeBanner?.targetUrl && activeBanner.targetUrl.trim() !== '');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
      {/* Decorative accent glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">User Banner</h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700/40">
                Temporary Announcement
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Publish a top announcement banner in any mode: Image Only, URL Only, or Image + URL. Auto-expires up to 24h.
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          {activeBanner ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Active • {formatTimeRemaining(activeBanner.secondsRemaining)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-800/60 border border-slate-700/50 text-slate-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>No Active Banner</span>
            </div>
          )}
          <button
            type="button"
            onClick={fetchCurrentBanner}
            disabled={isLoadingBanner}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 transition-colors cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingBanner ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedback && (
        <div className={`mt-4 p-3 rounded-2xl flex items-center gap-2 text-xs font-medium ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* CURRENT ACTIVE BANNER CARD (if active) */}
      {activeBanner && (
        <div className="mt-5 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Currently Live On User Panel • {hasActiveImage && hasActiveUrl ? 'Image + URL' : hasActiveImage ? 'Image Only' : 'URL Only'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Immediately remove active banner from User Panel"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Removing...' : 'Delete / Remove Banner'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Image Preview or URL-Only Card */}
            {hasActiveImage ? (
              <div className="md:col-span-2 relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                <img 
                  src={activeBanner.imageUrl!} 
                  alt="Active Banner" 
                  className="w-full h-32 sm:h-40 object-cover object-center"
                />
                {activeBanner.targetUrl && (
                  <a
                    href={activeBanner.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-white/20 text-white text-[11px] font-semibold flex items-center gap-1"
                  >
                    <span>Test Link</span>
                    <ExternalLink className="w-3 h-3 text-indigo-400" />
                  </a>
                )}
              </div>
            ) : (
              <div className="md:col-span-2 p-4 rounded-xl border border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white">URL Announcement Banner</div>
                    <div className="text-xs text-indigo-400 font-mono truncate mt-0.5">{activeBanner.targetUrl}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Mode: URL Only (No Image)</div>
                  </div>
                </div>
                {activeBanner.targetUrl && (
                  <a
                    href={activeBanner.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-white/20 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                  >
                    <span>Test Link</span>
                    <ExternalLink className="w-3 h-3 text-indigo-400" />
                  </a>
                )}
              </div>
            )}

            {/* Banner Details */}
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Destination Link:</span>
                  {hasActiveImage && hasActiveUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLinkOnly}
                      disabled={isDeleting}
                      className="text-rose-400 hover:text-rose-300 text-[11px] font-medium underline cursor-pointer"
                      title="Remove URL link and keep image only"
                    >
                      Remove Link Only
                    </button>
                  )}
                </div>
                <div className="text-slate-300 font-mono break-all mt-0.5">
                  {activeBanner.targetUrl ? (
                    <a 
                      href={activeBanner.targetUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span className="truncate">{activeBanner.targetUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-slate-500 italic">None (Image Only)</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-slate-500">Server Expiration:</span>
                <div className="text-amber-300 font-semibold mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{formatTimeRemaining(activeBanner.secondsRemaining)}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Exact: {new Date(activeBanner.expiresAt).toLocaleString()}
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[11px] text-slate-400">
                  Published for {activeBanner.durationHours} hours. Will automatically vanish once expired without leaving any empty container.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / PUBLISH BANNER FORM */}
      <form onSubmit={handlePublish} className="mt-5 space-y-4">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span>{activeBanner ? 'Replace Active Banner' : 'Create & Publish Banner'}</span>
        </div>

        {/* 1. Image Selection (Upload or URL) - OPTIONAL */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            Banner Image / Photo <span className="text-slate-500 font-normal">(Optional if URL is provided)</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* File Upload Button */}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                className="hidden"
                id="banner-file-input"
              />
              <label
                htmlFor="banner-file-input"
                className={`flex items-center justify-center gap-2 w-full p-3 rounded-2xl border border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-950/40 hover:bg-indigo-950/20 text-slate-300 text-xs font-semibold cursor-pointer transition-all ${
                  isUploading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Uploading image...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>Choose / Upload Photo (Max 5MB)</span>
                  </>
                )}
              </label>
            </div>

            {/* Direct Image URL input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <ImageIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Or paste image URL (https://...)"
                className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Selected Image Preview Thumbnail */}
          {imageUrl && (
            <div className="mt-2 p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="w-16 h-10 object-cover rounded-lg border border-slate-700 shrink-0" 
                  onError={() => setFeedback({ type: 'error', message: 'The entered image URL could not be loaded.' })}
                />
                <span className="text-[11px] text-slate-400 truncate font-mono">{imageUrl}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImageUrl('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-slate-400 hover:text-rose-400 text-xs p-1 cursor-pointer shrink-0"
                title="Clear selected image"
              >
                Clear Image
              </button>
            </div>
          )}
        </div>

        {/* 2. Target URL - OPTIONAL */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Website URL / Link <span className="text-slate-500 font-normal">(Optional if Image is provided)</span>
            </label>
            {targetUrl && (
              <button
                type="button"
                onClick={() => setTargetUrl('')}
                className="text-rose-400 hover:text-rose-300 text-xs font-medium cursor-pointer transition-colors"
                title="Remove URL link from input"
              >
                Clear URL
              </button>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <LinkIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="e.g. google.com, youtube.com, or https://example.com/page"
              className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            {targetUrl && (
              <button
                type="button"
                onClick={() => setTargetUrl('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-rose-400 cursor-pointer"
                title="Remove URL link"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Supports any website. If omitted, http:// or https:// will be added automatically. For URL-only mode, leave the image empty.
          </p>
        </div>

        {/* 3. Duration Selector (Max 24 Hours) */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Banner Duration <span className="text-indigo-400 font-bold">(Max 24 Hours)</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {[1, 6, 12, 24].map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => setDurationHours(hours)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  durationHours === hours
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {hours === 24 ? '24 Hours (Maximum)' : `${hours} Hours`}
              </button>
            ))}

            <div className="flex items-center gap-1.5 ml-auto text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Custom:</span>
              <input
                type="number"
                min="1"
                max="24"
                value={durationHours}
                onChange={(e) => setDurationHours(Math.min(24, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="w-14 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs text-center font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-500">hrs</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Server enforces expiration strictly. The banner automatically deletes itself after this time.
          </p>
        </div>

        {/* Submit Button - Disabled only if BOTH image and URL are empty */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isPublishing || isUploading || (!imageUrl.trim() && !targetUrl.trim())}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPublishing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Publishing Banner...</span>
              </>
            ) : (
              <>
                <Megaphone className="w-4 h-4" />
                <span>{activeBanner ? 'Update & Replace Active Banner' : 'Publish Banner to User Panel'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
