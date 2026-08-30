import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSociarax } from '../../context/SociaraxContext';
import { PlatformBadge } from '../Badges';
import { 
  Zap, 
  Link as LinkIcon, 
  Hash, 
  Wallet, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Info, 
  ArrowRight,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface NewOrderViewProps {
  onNavigate: (tab: string) => void;
  onOpenAuthModal: () => void;
  preselectedServiceId?: number | null;
}

export const NewOrderView: React.FC<NewOrderViewProps> = ({ 
  onNavigate, 
  onOpenAuthModal, 
  preselectedServiceId 
}) => {
  const { user } = useAuth();
  const { services, placeOrder, formatCurrency } = useSociarax();

  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<number | ''>('');
  
  const [link, setLink] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successOrder, setSuccessOrder] = useState<any | null>(null);

  // Bulletproof platform matching engine: category has priority over secondary mention tags
  const isServiceMatchingPlatform = (s: any, plat: string) => {
    if (!plat || plat === 'all') return true;
    const cat = (s.category || '').toLowerCase();
    const name = (s.name || '').toLowerCase();
    const p = (s.platform || '').toLowerCase();
    const target = plat.trim().toLowerCase();

    // 1. Strict YouTube check
    const isYt = (cat.includes('youtube') || cat.includes('yt ')) || 
                 (name.includes('youtube') && !cat.includes('facebook') && !cat.includes('instagram'));
    if (target === 'youtube') return isYt;
    if (isYt) return false; // Never leak YouTube services to other platforms

    // 2. Strict Instagram check
    const isInsta = (cat.includes('instagram') || cat.includes('ig ') || cat.includes('insta') || cat.includes('reels') || cat.includes('threads')) ||
                    (name.includes('instagram') && !cat.includes('facebook'));
    if (target === 'instagram') return isInsta;
    if (isInsta) return false; // Never leak Instagram services to other platforms

    // 3. Strict Telegram check
    const isTg = (cat.includes('telegram') || cat.includes('tg ')) || name.includes('telegram');
    if (target === 'telegram') return isTg;
    if (isTg) return false;

    // 4. Strict Facebook check
    const isFb = (cat.includes('facebook') || cat.includes('fb ') || cat.includes('page likes') || name.includes('facebook page') || name.includes('facebook likes') || name.includes('facebook followers') || p === 'facebook');
    if (target === 'facebook') return isFb;
    if (isFb) return false;

    // 5. Strict Twitter / X check
    const isTw = (cat.includes('twitter') || cat.includes('tweet') || cat.includes(' x ') || name.includes('twitter') || p === 'twitter');
    if (target === 'twitter') return isTw;
    if (isTw) return false;

    // 6. Strict Spotify check
    const isSp = (cat.includes('spotify') || name.includes('spotify') || p === 'spotify');
    if (target === 'spotify') return isSp;
    if (isSp) return false;

    // 7. Strict TikTok check
    const isTt = (cat.includes('tiktok') || name.includes('tiktok') || p === 'tiktok');
    if (target === 'tiktok') return isTt;
    if (isTt) return false;

    // 8. Strict Snapchat check
    const isSc = (cat.includes('snapchat') || cat.includes('snap ') || name.includes('snapchat') || p === 'snapchat');
    if (target === 'snapchat') return isSc;
    if (isSc) return false;

    // 9. Strict Discord check
    const isDc = (cat.includes('discord') || name.includes('discord') || p === 'discord');
    if (target === 'discord') return isDc;
    if (isDc) return false;

    // 10. Strict Traffic check
    const isTraffic = (cat.includes('traffic') || cat.includes('website') || cat.includes('seo') || name.includes('traffic') || p === 'traffic');
    if (target === 'traffic') return isTraffic;
    if (isTraffic) return false;

    return p === target;
  };

  // 1. Services strictly matching the selected platform
  const platformFilteredServices = useMemo(() => {
    if (selectedPlatform === 'all') return services;
    return services.filter(s => isServiceMatchingPlatform(s, selectedPlatform));
  }, [services, selectedPlatform]);

  // 2. Available unique categories strictly matching the selected platform
  const availableCategories = useMemo(() => {
    return Array.from(new Set(platformFilteredServices.map(s => s.category))).filter(Boolean);
  }, [platformFilteredServices]);

  // 3. Set default category when availableCategories change
  useEffect(() => {
    if (availableCategories.length > 0) {
      if (!selectedCategory || !availableCategories.includes(selectedCategory)) {
        setSelectedCategory(availableCategories[0]);
      }
    } else {
      setSelectedCategory('');
    }
  }, [availableCategories, selectedCategory]);

  // 4. Available services filtered by category and selected platform
  const availableServices = useMemo(() => {
    if (!selectedCategory) return platformFilteredServices;
    return platformFilteredServices.filter(s => s.category === selectedCategory);
  }, [platformFilteredServices, selectedCategory]);

  // 5. Set default service when category or services change
  useEffect(() => {
    if (preselectedServiceId) {
      const match = services.find(s => s.id === preselectedServiceId);
      if (match) {
        setSelectedPlatform(match.platform || 'all');
        setSelectedCategory(match.category);
        setSelectedServiceId(match.id);
        return;
      }
    }
    if (availableServices.length > 0) {
      if (!selectedServiceId || !availableServices.some(s => s.id === selectedServiceId)) {
        setSelectedServiceId(availableServices[0].id);
      }
    } else {
      setSelectedServiceId('');
    }
  }, [availableServices, selectedServiceId, preselectedServiceId, services]);

  // Selected Service Object
  const selectedService = useMemo(() => {
    return services.find(s => s.id === Number(selectedServiceId)) || null;
  }, [services, selectedServiceId]);

  // Live Price / Charge Calculation
  const calculatedCharge = useMemo(() => {
    if (!selectedService || !quantity || Number(quantity) <= 0) return 0;
    const qty = Number(quantity);
    return (qty / 1000) * selectedService.rate;
  }, [selectedService, quantity]);

  const isBalanceSufficient = useMemo(() => {
    if (!user) return true;
    return user.walletBalance >= calculatedCharge;
  }, [user, calculatedCharge]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessOrder(null);

    if (!user) {
      onOpenAuthModal();
      return;
    }

    if (!selectedServiceId || !link || !quantity) {
      setErrorMessage('Please fill in all order fields.');
      return;
    }

    const qty = Number(quantity);
    if (!selectedService) return;

    if (qty < selectedService.min) {
      setErrorMessage(`Minimum quantity for this service is ${selectedService.min.toLocaleString()}.`);
      return;
    }

    if (qty > selectedService.max) {
      setErrorMessage(`Maximum quantity for this service is ${selectedService.max.toLocaleString()}.`);
      return;
    }

    if (link.trim().length < 3) {
      setErrorMessage('Please enter a valid link or target URL.');
      return;
    }

    if (!isBalanceSufficient) {
      setErrorMessage(`Insufficient wallet balance. Required: ${formatCurrency(calculatedCharge)}, Available: ${formatCurrency(user.walletBalance)}.`);
      return;
    }

    setIsSubmitting(true);
    const res = await placeOrder(Number(selectedServiceId), link.trim(), qty);
    setIsSubmitting(false);

    if (res.success && res.order) {
      setSuccessOrder(res.order);
      setLink('');
      setQuantity('');
    } else {
      setErrorMessage(res.error || 'Failed to place order. Please try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-indigo-400" />
            <span>Place New Order</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Select your platform, service, enter your target link and quantity.
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shrink-0">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[11px] text-slate-400">Your Balance</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {formatCurrency(user.walletBalance)}
              </div>
            </div>
            <button
              onClick={() => onNavigate('wallet')}
              className="ml-2 px-2.5 py-1 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg transition-colors cursor-pointer"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {/* Success Notification Card */}
      {successOrder && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-2xl p-5 text-emerald-200 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Order #{successOrder.id} Placed Successfully!
                </h3>
                <p className="text-xs text-emerald-300/90 mt-0.5">
                  {successOrder.serviceName} • {successOrder.quantity.toLocaleString()} units • {formatCurrency(successOrder.charge)}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <span>Track Status</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Order Form Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Platform Selection Bar */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            1. Select Platform
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Platforms' },
              { id: 'instagram', label: 'Instagram' },
              { id: 'youtube', label: 'YouTube' },
              { id: 'telegram', label: 'Telegram' },
              { id: 'snapchat', label: 'Snapchat' },
              { id: 'facebook', label: 'Facebook' },
              { id: 'twitter', label: 'X / Twitter' },
              { id: 'spotify', label: 'Spotify' },
              { id: 'tiktok', label: 'TikTok' },
              { id: 'discord', label: 'Discord' },
              { id: 'traffic', label: 'Website Traffic' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { 
                  setSelectedPlatform(p.id); 
                  setSelectedCategory(''); 
                  setSelectedServiceId(''); 
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  selectedPlatform === p.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            {!isBalanceSufficient && user && (
              <button
                onClick={() => onNavigate('wallet')}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors"
              >
                Add Funds
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="space-y-6">
          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              2. Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setSelectedServiceId(''); }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat} className="bg-slate-950 text-white">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Service Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              3. Service
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
            >
              {availableServices.map(srv => (
                <option key={srv.id} value={srv.id} className="bg-slate-950 text-white">
                  #{srv.id} - {srv.name} — {formatCurrency(srv.rate)}/1k
                </option>
              ))}
            </select>
          </div>

          {/* Service Info Box */}
          {selectedService && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={selectedService.platform} />
                  <span className="text-xs text-slate-400 font-mono">ID: #{selectedService.id}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400">
                    Min: <strong className="text-white font-mono">{selectedService.min.toLocaleString()}</strong>
                  </span>
                  <span className="text-slate-400">
                    Max: <strong className="text-white font-mono">{selectedService.max.toLocaleString()}</strong>
                  </span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {formatCurrency(selectedService.rate)} / 1000
                  </span>
                </div>
              </div>

              {selectedService.description && (
                <div className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-semibold mb-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>Service Description & Guarantee</span>
                  </div>
                  <p className="whitespace-pre-line">{selectedService.description}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Speed: <strong className="text-slate-200">{selectedService.averageTime}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Refill Guarantee: <strong className="text-slate-200">{selectedService.refill ? 'Available (30 Days)' : 'No Refill'}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Link / URL Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              4. Target Link / Profile / Post URL
            </label>
            <div className="relative">
              <LinkIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://instagram.com/p/... or https://youtube.com/watch?v=..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Make sure the account or post is public.</p>
          </div>

          {/* Quantity Input & Charge Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                5. Quantity
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="number"
                  required
                  min={selectedService?.min || 10}
                  max={selectedService?.max || 100000}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder={`Min: ${selectedService?.min || 10}`}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* Live Charge Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-center">
              <div className="text-[11px] text-slate-400 font-medium">Total Charge (Server Calculated)</div>
              <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight mt-0.5">
                {formatCurrency(calculatedCharge)}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            {!user ? (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Sign In to Place Order</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : !isBalanceSufficient ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onNavigate('wallet')}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Add Funds to Wallet (Need {formatCurrency(calculatedCharge - user.walletBalance)} more)</span>
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !selectedService || !quantity || Number(quantity) <= 0}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Confirm & Place Order ({formatCurrency(calculatedCharge)})</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
