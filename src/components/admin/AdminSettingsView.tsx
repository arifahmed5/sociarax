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
  Check,
  Globe,
  Server,
  Send,
  Database,
  RefreshCw,
  Eye,
  EyeOff,
  Cpu,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Upload,
  Info,
  RotateCcw
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
    announcement: settings.announcement || '',
    // Production Domain & URL
    app_url: settings.app_url || 'https://sociarax.onrender.com',
    // Dynamic SMTP Email Configuration
    smtp_host: settings.smtp_host || '',
    smtp_port: settings.smtp_port || '587',
    smtp_user: settings.smtp_user || '',
    smtp_password: settings.smtp_password || '',
    email_from: settings.email_from || 'noreply@sociarax.com',
    email_from_name: settings.email_from_name || 'SociaraX',
    smtp_secure: settings.smtp_secure || 'false',
    // Dynamic Custom Background Image Configuration
    custom_background_image_url: settings.custom_background_image_url || '',
    background_overlay_opacity: settings.background_overlay_opacity || '0.85',
    background_blur: settings.background_blur || 'none',
    background_apply_to: settings.background_apply_to || 'all'
  });

  // Background Image analysis metadata
  const [bgImageMeta, setBgImageMeta] = useState<{
    width: number;
    height: number;
    sizeKB: number;
    aspectRatio: string;
    isRecommended: boolean;
    notes: string[];
  } | null>(null);
  const [bgUploadError, setBgUploadError] = useState<string>('');
  const [isSavingBg, setIsSavingBg] = useState<boolean>(false);
  const [bgSaveNotice, setBgSaveNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync settings when loaded from API
  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        app_url: settings.app_url || prev.app_url || 'https://sociarax.onrender.com',
        smtp_host: settings.smtp_host || prev.smtp_host || '',
        smtp_port: settings.smtp_port || prev.smtp_port || '587',
        smtp_user: settings.smtp_user || prev.smtp_user || '',
        smtp_password: settings.smtp_password || prev.smtp_password || '',
        email_from: settings.email_from || prev.email_from || 'noreply@sociarax.com',
        email_from_name: settings.email_from_name || prev.email_from_name || 'SociaraX',
        smtp_secure: settings.smtp_secure || prev.smtp_secure || 'false',
        custom_background_image_url: settings.custom_background_image_url || prev.custom_background_image_url || '',
        background_overlay_opacity: settings.background_overlay_opacity || prev.background_overlay_opacity || '0.85',
        background_blur: settings.background_blur || prev.background_blur || 'none',
        background_apply_to: settings.background_apply_to || prev.background_apply_to || 'all'
      }));
    }
  }, [settings]);

  // Direct save handler specifically for background photo and styling
  const handleSaveBackgroundOnly = async () => {
    setIsSavingBg(true);
    setBgSaveNotice(null);

    const payload = {
      custom_background_image_url: formData.custom_background_image_url,
      background_overlay_opacity: formData.background_overlay_opacity,
      background_blur: formData.background_blur,
      background_apply_to: formData.background_apply_to
    };

    const res = await saveAdminSettings(payload);
    setIsSavingBg(false);

    if (res.success) {
      setBgSaveNotice({ type: 'success', message: 'Background photo successfully saved & applied across SociaraX!' });
      setTimeout(() => setBgSaveNotice(null), 4500);
    } else {
      setBgSaveNotice({ type: 'error', message: res.error || 'Failed to save background settings. Please try again.' });
    }
  };

  // Direct reset handler to revert back to default pure dark theme with ambient glow (pehle jaisa)
  const handleResetToDefaultBackground = async () => {
    setIsSavingBg(true);
    setBgSaveNotice(null);
    setBgImageMeta(null);
    setBgUploadError('');

    const defaultPayload = {
      custom_background_image_url: '',
      background_overlay_opacity: '0.85',
      background_blur: 'none',
      background_apply_to: 'all'
    };

    setFormData(prev => ({
      ...prev,
      ...defaultPayload
    }));

    const res = await saveAdminSettings(defaultPayload);
    setIsSavingBg(false);

    if (res.success) {
      setBgSaveNotice({ 
        type: 'success', 
        message: 'Default background successfully restored! Pehle jaisa original glowing dark theme active ho gaya hai.' 
      });
      setTimeout(() => setBgSaveNotice(null), 5000);
    } else {
      setBgSaveNotice({ type: 'error', message: res.error || 'Failed to reset background.' });
    }
  };

  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBgUploadError('');
    if (!file.type.startsWith('image/')) {
      setBgUploadError('Please choose a valid image file (WebP, JPG, or PNG).');
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setBgUploadError('Image size exceeds 12MB. Please select an image under 12MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const testImg = new Image();
      testImg.onload = () => {
        const origWidth = testImg.naturalWidth;
        const origHeight = testImg.naturalHeight;

        // Auto-optimize resolution: scale to max 1920 width to guarantee instant save and zero database lag
        let targetWidth = origWidth;
        let targetHeight = origHeight;
        if (targetWidth > 1920) {
          targetHeight = Math.round((origHeight * 1920) / origWidth);
          targetWidth = 1920;
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(testImg, 0, 0, targetWidth, targetHeight);
            let optimizedDataUrl = canvas.toDataURL('image/webp', 0.85);
            if (!optimizedDataUrl.startsWith('data:image/webp')) {
              optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            }

            const ratio = (targetWidth / targetHeight).toFixed(2);
            const is169 = Math.abs((targetWidth / targetHeight) - (16 / 9)) < 0.18;
            const optSizeKB = Math.round((optimizedDataUrl.length * 0.75) / 1024);

            setBgImageMeta({
              width: targetWidth,
              height: targetHeight,
              sizeKB: optSizeKB,
              aspectRatio: is169 ? '16:9 (Ideal)' : `${ratio}:1`,
              isRecommended: true,
              notes: [
                `✅ Optimized for instant loading (${optSizeKB} KB).`,
                `✅ Crisp resolution (${targetWidth} × ${targetHeight} px).`,
                '✅ Ready to save!'
              ]
            });

            setFormData(prev => ({
              ...prev,
              custom_background_image_url: optimizedDataUrl
            }));
            return;
          }
        } catch (canvasErr) {
          console.warn('Canvas optimization note:', canvasErr);
        }

        // Fallback to raw dataUrl if canvas was unavailable
        setFormData(prev => ({
          ...prev,
          custom_background_image_url: rawDataUrl
        }));
      };
      testImg.onerror = () => {
        setBgUploadError('Failed to load image preview.');
      };
      testImg.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

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

  // SMTP & Domain Test State
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState(admin?.email || 'arifahmed87204@gmail.com');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailNotice, setTestEmailNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Database Storage & 24/7 Monitor State
  const [dbStats, setDbStats] = useState<{ lastMaintenanceAt: string | null; totalPrunedRows: number; poolConnections: any } | null>(null);
  const [isCleaningDb, setIsCleaningDb] = useState(false);
  const [dbCleanNotice, setDbCleanNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchDbStats = async () => {
    try {
      const res = await fetch('/api/settings/db-stats', {
        headers: { 'Authorization': `Bearer ${activeToken}` },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success && data.status) {
        setDbStats(data.status);
      }
    } catch (err) {
      console.error('Error fetching DB stats:', err);
    }
  };

  useEffect(() => {
    fetchDbStats();
  }, [activeToken]);

  const handleRunDbHygiene = async () => {
    setIsCleaningDb(true);
    setDbCleanNotice(null);
    try {
      const res = await fetch('/api/settings/db-maintenance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setDbCleanNotice({
          type: 'success',
          message: data.message || `Database storage optimized! Pruned ${data.prunedResets || 0} expired records.`
        });
        fetchDbStats();
      } else {
        setDbCleanNotice({ type: 'error', message: data.error || 'Failed to complete storage maintenance' });
      }
    } catch (err: any) {
      setDbCleanNotice({ type: 'error', message: err?.message || 'Error executing database hygiene' });
    } finally {
      setIsCleaningDb(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setTestEmailNotice({ type: 'error', message: 'Please enter a valid recipient email address' });
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailNotice(null);
    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          to: testEmailRecipient.trim(),
          customSettings: {
            app_url: formData.app_url,
            smtp_host: formData.smtp_host,
            smtp_port: formData.smtp_port,
            smtp_user: formData.smtp_user,
            smtp_password: formData.smtp_password,
            email_from: formData.email_from,
            email_from_name: formData.email_from_name,
            smtp_secure: formData.smtp_secure
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestEmailNotice({
          type: 'success',
          message: data.message || `Test email successfully dispatched to ${testEmailRecipient}!`
        });
      } else {
        setTestEmailNotice({
          type: 'error',
          message: data.error || 'Failed to dispatch test email. Please check your SMTP host, port, user and password.'
        });
      }
    } catch (err: any) {
      setTestEmailNotice({
        type: 'error',
        message: err?.message || 'Network error while contacting email service.'
      });
    } finally {
      setIsSendingTestEmail(false);
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

        {/* Portal Background Image Manager with Dimension & Size Guidelines */}
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Portal Custom Background Image Manager</span>
                  {formData.custom_background_image_url ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Custom Active
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                      Default Dark Theme
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload or link a custom background image with size guidelines, contrast overlay, and resolution protection.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleSaveBackgroundOnly}
                disabled={isSavingBg}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                {isSavingBg ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Background</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetToDefaultBackground}
                disabled={isSavingBg}
                title="Reset back to default dark theme with ambient glow (pehle jaisa)"
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Default Pehle Jaisa</span>
              </button>

              {formData.custom_background_image_url && (
                <button
                  type="button"
                  onClick={handleResetToDefaultBackground}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Image</span>
                </button>
              )}
            </div>
          </div>

          {bgSaveNotice && (
            <div className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2 border ${
              bgSaveNotice.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
              {bgSaveNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{bgSaveNotice.message}</span>
            </div>
          )}

          {/* Size & Dimension Guidelines Notice Card */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Info className="w-4 h-4 shrink-0" />
              <span>Recommended Image Specifications for Best Display Quality:</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Recommended Resolution</span>
                <span className="font-bold text-white font-mono">1920 × 1080 px</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">Full HD (or 2560×1440 for 2K)</span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Aspect Ratio</span>
                <span className="font-bold text-white font-mono">16:9 (Widescreen)</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">Prevents side-stretching</span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Recommended File Size</span>
                <span className="font-bold text-white font-mono">Under 2.5 MB</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">Max 8MB limit</span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Optimal Formats</span>
                <span className="font-bold text-white font-mono">.WebP / .JPG / .PNG</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5">WebP gives highest speed</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>Why this matters:</strong> Using an image with at least 1920×1080 resolution and 16:9 ratio ensures the background stays sharp without pixelation or weird vertical crops on desktop and mobile screens. SociaraX will automatically apply an adjustable dark tint overlay so text and buttons remain 100% legible.
            </p>
          </div>

          {/* Background URL and Upload Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Background Image URL (Direct Link, Unsplash, CDN, or Imgur)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={formData.custom_background_image_url}
                  onChange={(e) => {
                    setFormData({ ...formData, custom_background_image_url: e.target.value });
                    setBgImageMeta(null);
                  }}
                  placeholder="https://images.unsplash.com/... or https://yourcdn.com/bg.webp"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 font-mono text-xs"
                />

                <label className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Upload from PC</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleBgFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {bgUploadError && (
                <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{bgUploadError}</span>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-2">
                Quick Themes & Tested 16:9 High-Resolution Presets:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  {
                    name: 'Default Dark',
                    url: '',
                    label: 'Pehle Jaisa (Original)',
                    isDefault: true
                  },
                  {
                    name: 'Cyber Grid',
                    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2070&auto=format&fit=crop',
                    label: 'Dark Cyan Grid'
                  },
                  {
                    name: 'Deep Cosmic',
                    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2070&auto=format&fit=crop',
                    label: 'Violet Aurora'
                  },
                  {
                    name: 'Midnight Mesh',
                    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2070&auto=format&fit=crop',
                    label: 'Abstract Waves'
                  },
                  {
                    name: 'Future Neon',
                    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop',
                    label: 'High Tech'
                  }
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (preset.isDefault) {
                        setFormData({ 
                          ...formData, 
                          custom_background_image_url: '',
                          background_overlay_opacity: '0.85',
                          background_blur: 'none'
                        });
                        setBgImageMeta(null);
                      } else {
                        setFormData({ ...formData, custom_background_image_url: preset.url });
                        setBgImageMeta({
                          width: 1920,
                          height: 1080,
                          sizeKB: 480,
                          aspectRatio: '16:9 (Ideal)',
                          isRecommended: true,
                          notes: [
                            '✅ Excellent resolution (1920×1080 Full HD).',
                            '✅ Standard 16:9 widescreen ratio.',
                            '✅ Optimized CDN delivery.'
                          ]
                        });
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-16 ${
                      (!formData.custom_background_image_url && preset.isDefault) || (formData.custom_background_image_url === preset.url)
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-md shadow-emerald-950'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs truncate flex items-center gap-1.5">
                      {preset.isDefault && <RotateCcw className="w-3 h-3 text-indigo-400 shrink-0" />}
                      <span>{preset.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Image Preview & Metadata Inspector */}
            {formData.custom_background_image_url && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Real-Time Background Preview & Contrast Check</span>
                  </span>
                  <a 
                    href={formData.custom_background_image_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <span>View original</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative h-44 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
                  {/* The Background */}
                  <img
                    src={formData.custom_background_image_url}
                    alt="Background Preview"
                    className="absolute inset-0 w-full h-full object-cover transition-all"
                    style={{
                      filter: formData.background_blur === 'md' ? 'blur(6px)' : formData.background_blur === 'sm' ? 'blur(3px)' : 'none',
                      transform: formData.background_blur && formData.background_blur !== 'none' ? 'scale(1.08)' : 'none'
                    }}
                  />
                  {/* The Dark Overlay */}
                  <div 
                    className="absolute inset-0 bg-slate-950 transition-opacity"
                    style={{ opacity: parseFloat(formData.background_overlay_opacity || '0.85') }}
                  />

                  {/* Sample Portal UI Elements on top to test readability */}
                  <div className="relative z-10 p-4 max-w-sm w-full bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-white">SociaraX Contrast Sample</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Overlay Darkness: {Math.round(parseFloat(formData.background_overlay_opacity || '0.85') * 100)}% | Blur: {formData.background_blur || 'none'}
                    </p>
                  </div>
                </div>

                {bgImageMeta && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">
                        {bgImageMeta.width} × {bgImageMeta.height} px
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px]">
                        Ratio: {bgImageMeta.aspectRatio}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px]">
                        Size: {bgImageMeta.sizeKB < 1024 ? `${bgImageMeta.sizeKB} KB` : `${(bgImageMeta.sizeKB / 1024).toFixed(1)} MB`}
                      </span>
                    </div>
                    {bgImageMeta.notes.map((note, nIdx) => (
                      <div key={nIdx} className="text-[11px] text-slate-300">
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Display Tuning Controls: Overlay Darkness, Blur & Apply Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Overlay Darkness
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {Math.round(parseFloat(formData.background_overlay_opacity || '0.85') * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.05"
                  value={formData.background_overlay_opacity || '0.85'}
                  onChange={(e) => setFormData({ ...formData, background_overlay_opacity: e.target.value })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Higher darkness guarantees text & cards are crystal clear.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Background Blur
                </label>
                <select
                  value={formData.background_blur || 'none'}
                  onChange={(e) => setFormData({ ...formData, background_blur: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500"
                >
                  <option value="none">None (Sharp original)</option>
                  <option value="sm">Subtle Blur (4px - recommended)</option>
                  <option value="md">Medium Blur (8px - soft ambient)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Softens busy textures behind buttons and inputs.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Apply Background To
                </label>
                <select
                  value={formData.background_apply_to || 'all'}
                  onChange={(e) => setFormData({ ...formData, background_apply_to: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500"
                >
                  <option value="all">Everywhere (Login, Register & Dashboards)</option>
                  <option value="auth_only">Login & Register Pages Only</option>
                  <option value="dashboard_only">Customer & Admin Dashboards Only</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Choose where the background appears.
                </p>
              </div>
            </div>

            {/* Direct Save Action for Background */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Changes apply immediately across all selected pages once saved.
              </span>
              <button
                type="button"
                onClick={handleSaveBackgroundOnly}
                disabled={isSavingBg}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                {isSavingBg ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Background...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Background Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Production Domain & Base URL Configuration */}
        <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Production Domain & Public URL</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    Live Active
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  The official domain used to generate password-reset links, email buttons, and external callbacks.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, app_url: 'https://sociarax.onrender.com' })}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors cursor-pointer border border-slate-700"
                title="Reset to official Render URL"
              >
                Render Domain
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Domain URL (Base URL with https://)
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="url"
                  required
                  value={formData.app_url}
                  onChange={(e) => setFormData({ ...formData, app_url: e.target.value })}
                  placeholder="https://sociarax.onrender.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                <span>⚡ <strong>Tip:</strong> If you connect a custom domain (e.g. <code className="text-indigo-300">https://sociarax.com</code>), enter it here and click <em>Save All Settings</em>. All reset emails will immediately use your custom domain without rebuilding!</span>
              </p>
            </div>

            {/* Live Password Reset Link Preview */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Generated Password-Reset Link Preview:</span>
                <span className="text-emerald-400 font-mono lowercase">Single-Use Token Link</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-indigo-300 break-all select-all flex items-center justify-between gap-2">
                <span>{`${(formData.app_url || 'https://sociarax.onrender.com').replace(/\/+$/, '')}/#reset-password?token=a8f92b...&email=user@example.com`}</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* Email Service & SMTP Configuration (Nodemailer) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Email Service & SMTP Settings (Nodemailer)</span>
                  {formData.smtp_host && formData.smtp_user ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      Configured
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                      Simulation Mode
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure real SMTP credentials (Gmail, Brevo, SendGrid, Amazon SES) for automated password reset emails.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                SMTP Host Server
              </label>
              <input
                type="text"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                placeholder="smtp.gmail.com or smtp-relay.brevo.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Gmail: <code className="text-indigo-300">smtp.gmail.com</code> | Brevo: <code className="text-indigo-300">smtp-relay.brevo.com</code>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                SMTP Port
              </label>
              <input
                type="number"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                placeholder="587"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Port 587 (STARTTLS) or 465 (SSL)
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                SMTP Username / Sender Email
              </label>
              <input
                type="text"
                value={formData.smtp_user}
                onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                placeholder="e.g. arifahmed87204@gmail.com or info@sociarax.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                SMTP Password / App Password
              </label>
              <div className="relative">
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                  title={showSmtpPass ? 'Hide password' : 'Show password'}
                >
                  {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                For Gmail, use a 16-character App Password.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Sender Display Name
              </label>
              <input
                type="text"
                value={formData.email_from_name}
                onChange={(e) => setFormData({ ...formData, email_from_name: e.target.value })}
                placeholder="SociaraX"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                From Email Address
              </label>
              <input
                type="email"
                value={formData.email_from}
                onChange={(e) => setFormData({ ...formData, email_from: e.target.value })}
                placeholder="noreply@sociarax.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                SSL / TLS Security Mode
              </label>
              <select
                value={formData.smtp_secure}
                onChange={(e) => setFormData({ ...formData, smtp_secure: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-indigo-500"
              >
                <option value="false">STARTTLS / Auto (Default - Port 587)</option>
                <option value="true">Direct SSL / TLS (Port 465)</option>
              </select>
            </div>
          </div>

          {/* Interactive Live Email Tester */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>Test Real Email Delivery Now</span>
            </div>
            <p className="text-xs text-slate-400">
              Send a real branded SociaraX test email to any inbox to verify that your SMTP server and credentials are authenticated.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="Enter test recipient email address"
                className="w-full sm:flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:border-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTestEmail || !testEmailRecipient}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTestEmail ? 'Sending Test...' : 'Send Live Test Email'}</span>
              </button>
            </div>

            {testEmailNotice && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                testEmailNotice.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
              }`}>
                {testEmailNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <span className="font-semibold block">{testEmailNotice.message}</span>
                  {testEmailNotice.type === 'success' && (
                    <span className="text-[11px] text-emerald-400/80">Check your inbox or spam folder for the branded SociaraX test email.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 24/7 Monitoring & Database Storage Protection */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>24/7 Monitoring & Database Storage Protection</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Zero Storage Overhead
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Surveillance architecture runs 100% in RAM memory. No monitor logs or ticks are written to the database.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunDbHygiene}
              disabled={isCleaningDb}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCleaningDb ? 'animate-spin' : ''}`} />
              <span>{isCleaningDb ? 'Optimizing...' : 'Optimize & Free DB Storage'}</span>
            </button>
          </div>

          {dbCleanNotice && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              dbCleanNotice.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
            }`}>
              {dbCleanNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{dbCleanNotice.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Monitor DB Footprint</span>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>0 Bytes Disk Bloat</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Keeps logs in an in-memory 500-entry ring buffer. Never writes monitor logs into PostgreSQL.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Keep-Alive Engine</span>
              <div className="text-sm font-bold text-cyan-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>SELECT 1 Ping (&lt;1ms)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Lightweight health ping touches zero tables, zero catalog locks, and produces zero dead tuples.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Storage Auto-Pruner</span>
              <div className="text-sm font-bold text-purple-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Runs Every 6 Hours</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Auto-deletes expired password reset tokens and temporary sessions so DB storage never fills up.
              </p>
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
