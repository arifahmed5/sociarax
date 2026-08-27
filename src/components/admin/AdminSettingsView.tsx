import React, { useState, useEffect } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Settings, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  QrCode, 
  Megaphone, 
  LifeBuoy, 
  ShieldCheck,
  UserPlus,
  Trash2,
  Lock,
  Mail,
  Key,
  Building2,
  Coins,
  Wallet,
  Copy,
  Check
} from 'lucide-react';

interface AdminAccount {
  id: number;
  email: string;
  totpEnabled: boolean;
  failedAttempts: number;
  lastLoginAt: string | null;
  createdAt: string;
  isPrimary: boolean;
}

export const AdminSettingsView: React.FC = () => {
  const { settings, saveAdminSettings, syncProviderServices } = useSociarax();
  const { admin, adminToken, userToken } = useAuth();
  const activeToken = adminToken || userToken || localStorage.getItem('sociarax_admin_token') || localStorage.getItem('sociarax_user_token');

  const [formData, setFormData] = useState({
    site_name: settings.site_name || 'SociaraX',
    site_title: settings.site_title || 'SociaraX - Premium SMM Provider Panel',
    currency: settings.currency || 'INR',
    usd_to_inr_rate: settings.usd_to_inr_rate || '88.0',
    default_markup_percentage: settings.default_markup_percentage || '35.0',
    min_deposit: settings.min_deposit || '10',
    upi_id: settings.upi_id || '6001768808@axisbank',
    upi_secondary_id: settings.upi_secondary_id || '6001768808@ybl',
    upi_merchant_name: settings.upi_merchant_name || 'ARIF UDDIN AHMED',
    custom_qr_image_url: settings.custom_qr_image_url || '',
    bank_transfer_enabled: settings.bank_transfer_enabled ?? 'true',
    bank_name: settings.bank_name || 'State Bank of India / Axis Bank',
    bank_account_number: settings.bank_account_number || '6001768808',
    bank_account_holder: settings.bank_account_holder || 'ARIF UDDIN AHMED',
    bank_ifsc_code: settings.bank_ifsc_code || 'UTIB0000123',
    bank_branch: settings.bank_branch || 'Guwahati Branch (Current A/c)',
    bank_instructions: settings.bank_instructions || 'Transfer amount via IMPS / NEFT / RTGS and submit the UTR / Transaction Ref number below.',
    usdt_enabled: settings.usdt_enabled ?? 'true',
    usdt_network: settings.usdt_network || 'TRC20',
    usdt_wallet_address: settings.usdt_wallet_address || 'TY2D3vWaQkG98bA7K1xVq99mZ21LuvSMM99',
    usdt_qr_image_url: settings.usdt_qr_image_url || '',
    usdt_to_inr_rate: settings.usdt_to_inr_rate || '92.0',
    usdt_instructions: settings.usdt_instructions || 'Send exact USDT on the TRC20 network. Copy and paste the Transaction Hash (TXID) below.',
    support_email: settings.support_email || 'arifahmed87204@gmail.com',
    telegram_support: settings.telegram_support || '@arifahmed5_6',
    whatsapp_support: settings.whatsapp_support || '@arifahmed56',
    announcement: settings.announcement || ''
  });

  const handleScannerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size should be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      if (base64Data) {
        setFormData(prev => ({
          ...prev,
          custom_qr_image_url: base64Data
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUsdtQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size should be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      if (base64Data) {
        setFormData(prev => ({
          ...prev,
          usdt_qr_image_url: base64Data
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSyncingRates, setIsSyncingRates] = useState(false);
  const [syncRateNotice, setSyncRateNotice] = useState<string>('');

  // Admin Accounts State
  const [adminsList, setAdminsList] = useState<AdminAccount[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminNotice, setAdminNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Google Authenticator (TOTP) State
  const [totpStatus, setTotpStatus] = useState<{ totpEnabled: boolean; email?: string } | null>(null);
  const [loadingTotp, setLoadingTotp] = useState(false);
  const [isSettingUpTotp, setIsSettingUpTotp] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{ qrCodeDataUrl: string; manualKey: string; setupToken: string } | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');
  const [verifyingTotp, setVerifyingTotp] = useState(false);
  const [totpNotice, setTotpNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchTotpStatus = async () => {
    try {
      const res = await fetch('/api/auth/admin/totp/status', {
        headers: { 'Authorization': `Bearer ${activeToken}` },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setTotpStatus({ totpEnabled: data.totpEnabled, email: data.email });
      }
    } catch (err) {
      console.error('Error fetching TOTP status:', err);
    }
  };

  const handleGenerateTotpQr = async () => {
    setLoadingTotp(true);
    setTotpNotice(null);
    try {
      const res = await fetch('/api/auth/admin/totp/generate', { 
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json' 
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setTotpSetupData({
          qrCodeDataUrl: data.qrCodeDataUrl,
          manualKey: data.manualKey,
          setupToken: data.setupToken
        });
        setIsSettingUpTotp(true);
      } else {
        setTotpNotice({ type: 'error', message: data.error || 'Failed to generate QR code' });
      }
    } catch (err) {
      setTotpNotice({ type: 'error', message: 'Failed to generate 2FA setup QR code' });
    } finally {
      setLoadingTotp(false);
    }
  };

  const handleActivateTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpSetupData || !totpVerifyCode || totpVerifyCode.length !== 6) return;

    setVerifyingTotp(true);
    setTotpNotice(null);
    try {
      const res = await fetch('/api/auth/admin/totp/activate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}` 
        },
        credentials: 'include',
        body: JSON.stringify({
          setupToken: totpSetupData.setupToken,
          code: totpVerifyCode
        })
      });
      const data = await res.json();
      if (data.success) {
        setTotpNotice({ type: 'success', message: 'Google Authenticator 2FA is now active & verified!' });
        setIsSettingUpTotp(false);
        setTotpSetupData(null);
        setTotpVerifyCode('');
        fetchTotpStatus();
      } else {
        setTotpNotice({ type: 'error', message: data.error || 'Invalid 6-digit code' });
      }
    } catch (err) {
      setTotpNotice({ type: 'error', message: 'Failed to activate 2FA' });
    } finally {
      setVerifyingTotp(false);
    }
  };

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await fetch('/api/auth/admin/admins', {
        headers: { 'Authorization': `Bearer ${activeToken}` },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.admins)) {
        setAdminsList(data.admins);
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchTotpStatus();
  }, [activeToken]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword) return;

    setAddingAdmin(true);
    setAdminNotice(null);

    try {
      const res = await fetch('/api/auth/admin/admins', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}` 
        },
        credentials: 'include',
        body: JSON.stringify({ email: newAdminEmail, password: newAdminPassword })
      });
      const data = await res.json();

      if (data.success) {
        setAdminNotice({ type: 'success', message: data.message || 'Admin created successfully!' });
        setNewAdminEmail('');
        setNewAdminPassword('');
        fetchAdmins();
      } else {
        setAdminNotice({ type: 'error', message: data.error || 'Failed to add admin.' });
      }
    } catch (err: any) {
      setAdminNotice({ type: 'error', message: 'Network error creating admin account.' });
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adminId: number, email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from Admin Access?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/auth/admin/admins/${adminId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${activeToken}` },
        credentials: 'include'
      });
      const data = await res.json();

      if (data.success) {
        setAdminNotice({ type: 'success', message: data.message || 'Admin removed.' });
        fetchAdmins();
      } else {
        setAdminNotice({ type: 'error', message: data.error || 'Failed to delete admin.' });
      }
    } catch (err) {
      setAdminNotice({ type: 'error', message: 'Error deleting admin.' });
    }
  };

  const handleSyncAllRates = async () => {
    setIsSyncingRates(true);
    setSyncRateNotice('');
    try {
      const res = await syncProviderServices(1, parseFloat(formData.default_markup_percentage) || 35);
      if (res.success) {
        setSyncRateNotice(res.message || 'All provider services synchronized and converted to INR!');
      } else {
        setSyncRateNotice(res.error || 'Sync failed');
      }
    } catch (err: any) {
      setSyncRateNotice(err.message || 'Failed to sync rates');
    } finally {
      setIsSyncingRates(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveNotice(null);

    const res = await saveAdminSettings(formData);
    setIsSaving(false);

    if (res.success) {
      setSaveNotice({ type: 'success', message: 'System settings updated successfully!' });
      setTimeout(() => setSaveNotice(null), 4000);
    } else {
      setSaveNotice({ type: 'error', message: res.error || 'Failed to update settings' });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" />
          <span>System Settings & Access Control</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Configure site branding, UPI payment receiving details, live announcements, and authorized admin email accounts.
        </p>
      </div>

      {saveNotice && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
          saveNotice.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
        }`}>
          {saveNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{saveNotice.message}</span>
        </div>
      )}

      {/* Admin Accounts & Access Control Manager */}
      <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Authorized Admin Accounts</h2>
              <p className="text-xs text-slate-400">Only authorized admin emails can log in to this panel with 2FA TOTP.</p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 font-mono border border-rose-500/30">
            {adminsList.length} Active Admins
          </span>
        </div>

        {adminNotice && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            adminNotice.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
          }`}>
            {adminNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{adminNotice.message}</span>
          </div>
        )}

        {/* Existing Admins List */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-slate-300">Registered Admin Accounts</label>
          {loadingAdmins ? (
            <div className="p-4 text-center text-xs text-slate-500">Loading admin accounts...</div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {adminsList.map((adm) => {
                const isCurrent = admin && adm.id === admin.id;
                return (
                  <div 
                    key={adm.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-white font-mono truncate">{adm.email}</span>
                          {adm.isPrimary && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Primary Owner
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>2FA TOTP: {adm.totpEnabled ? <span className="text-emerald-400 font-semibold">Enabled</span> : <span className="text-amber-400 font-semibold">Pending First Login</span>}</span>
                          {adm.lastLoginAt && <span>• Last Active: {new Date(adm.lastLoginAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>

                    {!adm.isPrimary && !isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAdmin(adm.id, adm.email)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer shrink-0"
                        title="Remove Admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add New Admin Form */}
        <form onSubmit={handleAddAdmin} className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <UserPlus className="w-4 h-4 text-rose-400" />
            <span>Grant Admin Access to New Email</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Admin Email Address</label>
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="e.g. colleague@gmail.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Temporary Initial Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={addingAdmin || !newAdminEmail || !newAdminPassword}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{addingAdmin ? 'Authorizing Admin...' : 'Authorize New Admin Account'}</span>
          </button>
        </form>
      </div>

      {/* Google Authenticator (TOTP) Security Center */}
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Google Authenticator (2FA / TOTP)</h2>
              <p className="text-xs text-slate-400">Real-time time-based one-time password security for Admin logins.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totpStatus?.totpEnabled ? (
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active & Bound
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> 2FA Setup Needed
              </span>
            )}
          </div>
        </div>

        {totpNotice && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            totpNotice.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
          }`}>
            {totpNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{totpNotice.message}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Primary Administrator 2FA Status</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Protected Account: <strong className="text-indigo-300 font-mono">{admin?.email || 'arifahmed87204@gmail.com'}</strong>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                You can generate a new QR code anytime to scan into your Google Authenticator app on Android / iPhone.
              </p>
            </div>
            {!isSettingUpTotp && (
              <button
                type="button"
                onClick={handleGenerateTotpQr}
                disabled={loadingTotp}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 shrink-0"
              >
                <QrCode className="w-4 h-4" />
                <span>{loadingTotp ? 'Generating QR...' : (totpStatus?.totpEnabled ? 'Re-sync / Scan New QR Code' : 'Setup Google Authenticator')}</span>
              </button>
            )}
          </div>

          {/* Interactive QR Setup Box */}
          {isSettingUpTotp && totpSetupData && (
            <div className="pt-4 border-t border-slate-800 space-y-5 animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-900 border border-indigo-500/30">
                <div className="bg-white p-3 rounded-xl shrink-0 shadow-lg">
                  <img 
                    src={totpSetupData.qrCodeDataUrl} 
                    alt="Google Authenticator QR Code" 
                    className="w-36 h-36 object-contain"
                  />
                </div>

                <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Step 1: Scan QR in App</span>
                  <h4 className="text-sm font-bold text-white">Open Google Authenticator on your phone</h4>
                  <p className="text-xs text-slate-400">
                    Tap the <strong>+</strong> button in Google Authenticator and select <strong>Scan a QR code</strong>.
                  </p>
                  <div className="pt-2">
                    <span className="text-[11px] text-slate-500 block">Or enter this manual secret key:</span>
                    <code className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 select-all block mt-1 break-all">
                      {totpSetupData.manualKey}
                    </code>
                  </div>
                </div>
              </div>

              {/* Step 2: Confirm with 6-digit code */}
              <form onSubmit={handleActivateTotp} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Step 2: Verify 6-Digit Code</span>
                <p className="text-xs text-slate-300">
                  Enter the 6-digit verification code currently showing in your Google Authenticator app:
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full sm:w-48 bg-slate-950 border border-indigo-500/50 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold text-white tracking-[0.3em] focus:border-indigo-400"
                  />

                  <button
                    type="submit"
                    disabled={verifyingTotp || totpVerifyCode.length !== 6}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{verifyingTotp ? 'Verifying...' : 'Confirm & Activate 2FA'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setIsSettingUpTotp(false); setTotpSetupData(null); }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Currency & Profit Margin Conversion Settings */}
        <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-lg font-mono">₹</span>
              <span>USD to INR Currency & Profit Margin Settings</span>
            </h2>
            <button
              type="button"
              onClick={handleSyncAllRates}
              disabled={isSyncingRates}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <span>{isSyncingRates ? 'Syncing Rates...' : '⚡ Re-calculate All Provider Rates'}</span>
            </button>
          </div>

          {syncRateNotice && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncRateNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                USD to INR Conversion Rate (1 USD = ₹ INR)
              </label>
              <div className="relative">
                <span className="text-slate-500 absolute left-3 top-2.5 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={formData.usd_to_inr_rate}
                  onChange={(e) => setFormData({ ...formData, usd_to_inr_rate: e.target.value })}
                  placeholder="88.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                LuvSMM charges in USD ($). SociaraX multiplies provider cost by this rate so you never face losses.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Default Profit Margin Markup Percentage (%)
              </label>
              <div className="relative">
                <span className="text-slate-500 absolute right-4 top-2.5 font-bold">%</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={formData.default_markup_percentage}
                  onChange={(e) => setFormData({ ...formData, default_markup_percentage: e.target.value })}
                  placeholder="35.0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Automated profit margin added on top of provider cost (e.g. +35% profit per 1,000 quantity).
              </p>
            </div>
          </div>
        </div>

        {/* Payment & UPI Gateway Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>UPI & Manual Payment Gateway</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Primary Merchant UPI ID (For Customer Deposits)
              </label>
              <input
                type="text"
                required
                value={formData.upi_id}
                onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                placeholder="e.g. 6001768808@axisbank"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">Primary VPA address for customer payments.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Secondary UPI ID (Optional Backup)
              </label>
              <input
                type="text"
                value={formData.upi_secondary_id}
                onChange={(e) => setFormData({ ...formData, upi_secondary_id: e.target.value })}
                placeholder="e.g. 6001768808@ybl"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">Secondary UPI ID shown to users if needed.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Merchant Business Name / Account Holder
              </label>
              <input
                type="text"
                required
                value={formData.upi_merchant_name}
                onChange={(e) => setFormData({ ...formData, upi_merchant_name: e.target.value })}
                placeholder="e.g. ARIF UDDIN AHMED"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Minimum Deposit Amount (INR ₹)
              </label>
              <div className="relative">
                <span className="text-slate-500 absolute left-3 top-2.5 font-bold">₹</span>
                <input
                  type="number"
                  required
                  min={1}
                  value={formData.min_deposit}
                  onChange={(e) => setFormData({ ...formData, min_deposit: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Scanner / QR Code Image Update Option */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-purple-400" />
                  <span>Custom Scanner / QR Code Image Setting</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update or replace your payment scanner standee image anytime.
                </p>
              </div>
              {formData.custom_qr_image_url && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, custom_qr_image_url: '' }))}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Reset to Auto-Generated Dynamic QR
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-8 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Option A: Upload Scanner Photo from Device (PhonePe / GPay / Paytm Standee)
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900 rounded-xl cursor-pointer transition-all">
                    <QrCode className="w-6 h-6 text-indigo-400 mb-1.5" />
                    <span className="text-xs font-semibold text-slate-200">Click to Select or Drag & Drop Scanner Image</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">Supports PNG, JPG, JPEG, WEBP (Max 5MB)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleScannerFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Option B: Or Enter Direct Image Web URL
                  </label>
                  <input
                    type="url"
                    value={formData.custom_qr_image_url}
                    onChange={(e) => setFormData({ ...formData, custom_qr_image_url: e.target.value })}
                    placeholder="https://example.com/my-scanner.png"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Leave blank to use the auto-generated high-speed PhonePe QR code.
                  </p>
                </div>
              </div>

              {/* Scanner Live Preview Box */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Scanner Preview
                </span>
                {formData.custom_qr_image_url ? (
                  <div className="bg-white p-2 rounded-xl shadow-lg relative group">
                    <img
                      src={formData.custom_qr_image_url}
                      alt="Custom Scanner Preview"
                      className="w-32 h-32 object-contain rounded-lg"
                      onError={() => alert('Could not load scanner image preview. Please verify URL or file.')}
                    />
                    <div className="text-[10px] text-emerald-600 font-bold mt-1">
                      Custom Scanner Active
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-2 rounded-xl shadow-lg flex flex-col items-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${formData.upi_id}&pn=${encodeURIComponent(formData.upi_merchant_name)}&cu=INR`)}`}
                      alt="Dynamic UPI QR Preview"
                      className="w-32 h-32 object-contain rounded-lg"
                    />
                    <div className="text-[10px] text-purple-700 font-bold mt-1">
                      Dynamic PhonePe QR
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Transfer Gateway Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Direct Bank Account Transfer Gateway (NEFT / IMPS / RTGS)</span>
            </h2>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.bank_transfer_enabled === 'true'}
                onChange={(e) => setFormData({ ...formData, bank_transfer_enabled: e.target.checked ? 'true' : 'false' })}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-300">Enable Bank Transfer Option</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Bank Name
              </label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="e.g. State Bank of India / Axis Bank"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Beneficiary receiving bank name.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Account Holder / Beneficiary Name
              </label>
              <input
                type="text"
                value={formData.bank_account_holder}
                onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })}
                placeholder="e.g. ARIF UDDIN AHMED"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Exact name registered with bank.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Account Number
              </label>
              <input
                type="text"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                placeholder="e.g. 6001768808 or 919876543210"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">Receiving savings or current account number.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                IFSC Code
              </label>
              <input
                type="text"
                value={formData.bank_ifsc_code}
                onChange={(e) => setFormData({ ...formData, bank_ifsc_code: e.target.value.toUpperCase() })}
                placeholder="e.g. UTIB0000123 / SBIN0001234"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono uppercase"
              />
              <p className="text-[11px] text-slate-500 mt-1">11-character Indian Financial System Code.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Branch / Account Type
              </label>
              <input
                type="text"
                value={formData.bank_branch}
                onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                placeholder="e.g. Guwahati Main Branch (Current A/c)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                User Instructions / Notes
              </label>
              <input
                type="text"
                value={formData.bank_instructions}
                onChange={(e) => setFormData({ ...formData, bank_instructions: e.target.value })}
                placeholder="e.g. Transfer via IMPS/NEFT and submit UTR below"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* USDT / Crypto Gateway Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>USDT / Cryptocurrency Payment Gateway</span>
            </h2>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.usdt_enabled === 'true'}
                onChange={(e) => setFormData({ ...formData, usdt_enabled: e.target.checked ? 'true' : 'false' })}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700 focus:ring-emerald-500"
              />
              <span className="text-xs font-semibold text-slate-300">Enable USDT / Crypto Option</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                USDT Network / Blockchain
              </label>
              <select
                value={formData.usdt_network}
                onChange={(e) => setFormData({ ...formData, usdt_network: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500"
              >
                <option value="TRC20">TRON (TRC20) - Recommended / Low Fees</option>
                <option value="BEP20">BNB Smart Chain (BEP20)</option>
                <option value="POLYGON">Polygon (POL / MATIC)</option>
                <option value="ERC20">Ethereum (ERC20)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Network required for receiving address.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                USDT Receiving Wallet Address
              </label>
              <input
                type="text"
                value={formData.usdt_wallet_address}
                onChange={(e) => setFormData({ ...formData, usdt_wallet_address: e.target.value })}
                placeholder="e.g. TY2D3vWaQkG98bA7K1xVq99mZ21LuvSMM99"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">Your Binance, TrustWallet, or TronLink USDT deposit address.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                USDT to INR Exchange Rate (1 USDT = ₹ INR)
              </label>
              <div className="relative">
                <span className="text-slate-500 absolute left-3.5 top-2.5 font-bold">₹</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={formData.usdt_to_inr_rate}
                  onChange={(e) => setFormData({ ...formData, usdt_to_inr_rate: e.target.value })}
                  placeholder="92.0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white focus:border-emerald-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Users depositing in USDT get credited INR at this rate.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                USDT Instructions for Users
              </label>
              <input
                type="text"
                value={formData.usdt_instructions}
                onChange={(e) => setFormData({ ...formData, usdt_instructions: e.target.value })}
                placeholder="e.g. Send exact USDT on TRC20 network. Enter TXID hash below."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500"
              />
            </div>
          </div>

          {/* USDT Scanner / QR Code Image Update Option */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>USDT Crypto QR Code Scanner Image</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload your Binance / Crypto wallet QR scanner image or let SociaraX auto-generate the crypto QR.
                </p>
              </div>
              {formData.usdt_qr_image_url && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, usdt_qr_image_url: '' }))}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Reset to Auto-Generated Crypto QR
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-8 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Option A: Upload USDT QR Photo from Device
                  </label>
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-900 rounded-xl cursor-pointer transition-all">
                    <QrCode className="w-6 h-6 text-emerald-400 mb-1.5" />
                    <span className="text-xs font-semibold text-slate-200">Click to Select or Drag & Drop USDT QR Image</span>
                    <span className="text-[11px] text-slate-500 mt-0.5">Supports PNG, JPG, JPEG, WEBP (Max 5MB)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleUsdtQrFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Option B: Or Enter Direct USDT QR Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.usdt_qr_image_url}
                    onChange={(e) => setFormData({ ...formData, usdt_qr_image_url: e.target.value })}
                    placeholder="https://example.com/usdt-qr.png"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* USDT QR Live Preview Box */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  USDT QR Preview
                </span>
                {formData.usdt_qr_image_url ? (
                  <div className="bg-white p-2 rounded-xl shadow-lg relative group">
                    <img
                      src={formData.usdt_qr_image_url}
                      alt="Custom USDT QR Preview"
                      className="w-32 h-32 object-contain rounded-lg"
                      onError={() => alert('Could not load USDT QR preview. Please check file or URL.')}
                    />
                    <div className="text-[10px] text-emerald-600 font-bold mt-1">
                      Custom Crypto QR Active
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-2 rounded-xl shadow-lg flex flex-col items-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(formData.usdt_wallet_address || 'USDT-TRC20')}`}
                      alt="Dynamic USDT QR"
                      className="w-32 h-32 object-contain rounded-lg"
                    />
                    <div className="text-[10px] text-emerald-700 font-bold mt-1">
                      Dynamic {formData.usdt_network} QR
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Announcement Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Megaphone className="w-4 h-4 text-indigo-400" />
            <span>Customer Announcement Broadcast</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Broadcast Message (Displayed on top of user dashboard)
            </label>
            <textarea
              rows={3}
              value={formData.announcement}
              onChange={(e) => setFormData({ ...formData, announcement: e.target.value })}
              placeholder="e.g. All Instagram and YouTube services are running with instant speed and high retention."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Branding & Support Contacts */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <LifeBuoy className="w-4 h-4 text-purple-400" />
            <span>Branding & Support Channels</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Site Name</label>
              <input
                type="text"
                required
                value={formData.site_name}
                onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Support Email</label>
              <input
                type="email"
                value={formData.support_email}
                onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Telegram Support Handle</label>
              <input
                type="text"
                value={formData.telegram_support}
                onChange={(e) => setFormData({ ...formData, telegram_support: e.target.value })}
                placeholder="@arifahmed5_6"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">WhatsApp Support ID / Number</label>
              <input
                type="text"
                value={formData.whatsapp_support}
                onChange={(e) => setFormData({ ...formData, whatsapp_support: e.target.value })}
                placeholder="@arifahmed56"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Changes...' : 'Save All Settings'}</span>
        </button>
      </form>
    </div>
  );
};
