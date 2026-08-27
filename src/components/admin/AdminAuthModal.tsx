import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TotpSetupData } from '../../types';
import { 
  X, 
  Lock, 
  Mail, 
  ShieldCheck, 
  Key, 
  QrCode, 
  Copy, 
  Check, 
  AlertCircle, 
  ArrowRight,
  Smartphone
} from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose }) => {
  const { adminLoginStep1, completeTotpSetup, verifyAdminTotp } = useAuth();

  // Phase: 'credentials' | 'totp_setup' | 'totp_verify'
  const [phase, setPhase] = useState<'credentials' | 'totp_setup' | 'totp_verify'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  // Step 1: Submit Credentials
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const res = await adminLoginStep1(email, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid admin credentials');
      return;
    }

    if (res.requireTotpSetup && res.setupData) {
      setSetupData(res.setupData);
      setPhase('totp_setup');
    } else if (res.requireTotpCode && res.tempToken) {
      setTempToken(res.tempToken);
      setPhase('totp_verify');
    }
  };

  // Step 2a: Complete TOTP Setup
  const handleTotpSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;
    setErrorMessage('');
    setIsLoading(true);

    const res = await completeTotpSetup(setupData.setupToken, totpCode);
    setIsLoading(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMessage(res.error || 'Invalid 6-digit code. Please try again.');
    }
  };

  // Step 2b: Verify Existing TOTP
  const handleTotpVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    setErrorMessage('');
    setIsLoading(true);

    const res = await verifyAdminTotp(tempToken, totpCode);
    setIsLoading(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMessage(res.error || 'Invalid 6-digit verification code.');
    }
  };

  const copyManualKey = () => {
    if (setupData?.manualKey) {
      navigator.clipboard.writeText(setupData.manualKey.replace(/\s+/g, ''));
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden text-slate-100">
        {/* Glow styling */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Phase 1: Password Login */}
        {phase === 'credentials' && (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 shadow-lg shadow-rose-600/20 mb-3">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                SociaraX Admin Portal
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Protected area. Requires administrative authorization and 2FA.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@sociarax.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Continue to 2FA Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Phase 2a: Google Authenticator Setup (First Time) */}
        {phase === 'totp_setup' && setupData && (
          <div>
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/20 mb-3">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Set Up Google Authenticator
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Scan the QR code below using Google Authenticator or any standard TOTP app.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl mb-4 max-w-[200px] mx-auto shadow-md">
              <img
                src={setupData.qrCodeDataUrl}
                alt="Google Authenticator QR Code"
                className="w-40 h-40 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Manual Secret Key */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
              <div className="text-[11px] text-slate-400 mb-1">Manual Setup Key:</div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-indigo-300 tracking-wider select-all break-all">
                  {setupData.manualKey}
                </span>
                <button
                  type="button"
                  onClick={copyManualKey}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors shrink-0"
                  title="Copy Key"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Verification Code Form */}
            <form onSubmit={handleTotpSetupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Enter 6-Digit Code from Authenticator App
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || totpCode.length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Activate 2FA & Access Admin</span>
                    <ShieldCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Phase 2b: Regular 6-Digit TOTP Verification */}
        {phase === 'totp_verify' && (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-rose-600 shadow-lg shadow-rose-600/20 mb-3">
                <Key className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Two-Factor Authentication
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Open Google Authenticator on your mobile device and enter the 6-digit code.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleTotpVerifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 text-center">
                  6-Digit Security Code
                </label>
                <div className="relative max-w-xs mx-auto">
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    pattern="[0-9]{6}"
                    inputMode="numeric"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-center text-2xl font-mono tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || totpCode.length !== 6}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify & Enter Admin Panel</span>
                    <ShieldCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
