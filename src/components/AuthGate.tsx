import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useSociarax } from '../context/SociaraxContext';
import { 
  Zap, 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Send, 
  MessageCircle,
  Instagram, 
  Youtube, 
  Ghost,
  Twitter,
  Music,
  KeyRound,
  X,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

interface AuthGateProps {
  onOpenAdminAuth: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onOpenAdminAuth }) => {
  const { 
    loginUser, 
    loginWithGoogle,
    registerUser, 
    checkAccountForOtp, 
    requestPasswordResetOtp, 
    verifyOtpAndResetPassword,
    verifyResetToken,
    resetPasswordWithToken
  } = useAuth();
  const { settings } = useSociarax();
  
  // Tabs: ONLY 'register' and 'login'
  const [mode, setMode] = useState<'register' | 'login'>('login');
  
  // Register fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  
  // Login fields
  const [identifier, setIdentifier] = useState('');
  
  // Global UI states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Google OAuth states
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleLoadingMessage, setGoogleLoadingMessage] = useState('Connecting to Google Authentication...');

  // ==========================================
  // Secure OTP & Branded Email Forgot Password Modal State
  // ==========================================
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'identify' | 'verify_otp' | 'reset_with_token'>('identify');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotChannels, setForgotChannels] = useState<Array<{ id: 'email' | 'phone'; label: string; masked: string }>>([]);
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'phone'>('email');
  
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [resetUrlToken, setResetUrlToken] = useState('');
  const [tokenAccountInfo, setTokenAccountInfo] = useState<{ username?: string; maskedEmail?: string } | null>(null);

  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Detect Password Reset Token from Email Link in URL
  useEffect(() => {
    const detectResetToken = async () => {
      if (typeof window === 'undefined') return;
      let token = new URLSearchParams(window.location.search).get('token') ||
                  new URLSearchParams(window.location.search).get('reset_token');

      if (!token && window.location.hash) {
        const hashStr = window.location.hash;
        const qIdx = hashStr.indexOf('?');
        if (qIdx !== -1) {
          const hashParams = new URLSearchParams(hashStr.slice(qIdx));
          token = hashParams.get('token') || hashParams.get('reset_token');
        }
      }

      if (token) {
        setResetUrlToken(token);
        setIsForgotModalOpen(true);
        setForgotStep('reset_with_token');
        setForgotLoading(true);
        setForgotError('');
        const res = await verifyResetToken(token);
        setForgotLoading(false);

        if (res.success && res.valid) {
          setTokenAccountInfo({ username: res.username, maskedEmail: res.maskedEmail });
          setForgotSuccess(`Verified reset link for ${res.username ? `@${res.username}` : ''} ${res.maskedEmail || ''}. Please enter your new password.`);
        } else {
          setForgotError(res.error || 'This password reset link is invalid or has expired. Please request a new link.');
        }
      }
    };

    detectResetToken();
  }, [verifyResetToken]);

  // Timer countdown for resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const openForgotPassword = () => {
    setForgotIdentifier(identifier || '');
    setForgotStep('identify');
    setForgotChannels([]);
    setSelectedChannel('email');
    setOtpCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotError('');
    setForgotSuccess('');
    setIsForgotModalOpen(true);
  };

  const closeForgotPassword = () => {
    setIsForgotModalOpen(false);
    setForgotError('');
    setForgotSuccess('');
  };

  // Reset password using verified token from email link
  const handleResetWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!newPassword || newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotError('New password and confirmation do not match.');
      return;
    }

    setForgotLoading(true);
    const res = await resetPasswordWithToken(resetUrlToken, newPassword, confirmNewPassword);
    setForgotLoading(false);

    if (res.success) {
      setForgotSuccess('Password updated successfully! Entering SociaraX dashboard...');
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      setTimeout(() => {
        setIsForgotModalOpen(false);
      }, 1200);
    } else {
      setForgotError(res.error || 'Failed to reset password. Please try requesting a new link.');
    }
  };

  // User Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!username.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (username.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Please accept the Terms of Service to proceed.');
      return;
    }

    setIsLoading(true);
    const res = await registerUser(username.trim(), email.trim(), password, phone.trim() || undefined);
    setIsLoading(false);

    if (res.success) {
      setSuccessMessage('Account created successfully! Entering SociaraX dashboard...');
    } else {
      setErrorMessage(res.error || 'Registration failed. Please check your details or try another username/email.');
    }
  };

  // Direct User Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter your username/email and password.');
      return;
    }

    setIsLoading(true);
    const res = await loginUser(identifier.trim(), password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid username or password. Click "Forgot Password?" below to verify with OTP.');
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Check if returning from a Google redirect sign-in
    getRedirectResult(auth)
      .then(async (result) => {
        if (!isMounted || !result || !result.user) return;
        setIsGoogleLoading(true);
        setGoogleLoadingMessage('Verifying credentials & entering SociaraX...');
        const idToken = await result.user.getIdToken();
        const res = await loginWithGoogle(
          idToken,
          result.user.email || undefined,
          result.user.displayName || undefined
        );

        if (res.success && isMounted) {
          setSuccessMessage('Successfully signed in with Google! Entering SociaraX dashboard...');
          setIsGoogleLoading(false);
        } else if (isMounted) {
          setIsGoogleLoading(false);
          setErrorMessage(res.error || 'Failed to authenticate Google account with SociaraX server.');
        }
      })
      .catch((err: any) => {
        console.warn('[AUTH] Google redirect check notice:', err?.message || err);
        if (isMounted) setIsGoogleLoading(false);
      });

    // 2. Synchronize active Firebase Auth state automatically
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted || !firebaseUser) return;
      const savedToken = localStorage.getItem('sociarax_user_token');
      if (!savedToken) {
        setIsGoogleLoading(true);
        setGoogleLoadingMessage('Firebase verified! Entering SociaraX dashboard...');
        try {
          const idToken = await firebaseUser.getIdToken();
          const res = await loginWithGoogle(
            idToken,
            firebaseUser.email || undefined,
            firebaseUser.displayName || undefined
          );
          if (res.success && isMounted) {
            setSuccessMessage('Successfully signed in! Loading dashboard...');
            setIsGoogleLoading(false);
          } else if (isMounted) {
            setIsGoogleLoading(false);
          }
        } catch {
          if (isMounted) setIsGoogleLoading(false);
        }
      }
    });

    // 3. Initialize Google Identity Services if available in browser
    const initGsi = () => {
      try {
        if ((window as any).google?.accounts?.id) {
          (window as any).google.accounts.id.initialize({
            client_id: '518031039811-3k8c5t6ghlls3kpafgmp2f33gihq9217.apps.googleusercontent.com',
            use_fedcm_for_prompt: false,
            auto_select: false,
            callback: async (response: any) => {
              if (response?.credential && isMounted) {
                setIsGoogleLoading(true);
                setGoogleLoadingMessage('Verifying your Google Account with SociaraX...');
                const res = await loginWithGoogle(response.credential);
                if (res.success && isMounted) {
                  setGoogleLoadingMessage('Welcome to SociaraX! Loading your dashboard...');
                  setSuccessMessage('Successfully signed in with Google!');
                  try {
                    const cred = GoogleAuthProvider.credential(response.credential);
                    await signInWithCredential(auth, cred);
                  } catch (syncErr) {
                    console.warn('[FIREBASE SYNC]', syncErr);
                  }
                  setIsGoogleLoading(false);
                } else if (isMounted) {
                  setIsGoogleLoading(false);
                  setErrorMessage(res.error || 'Failed to authenticate Google account.');
                }
              }
            }
          });

          // Check if document is embedded in an iframe or if identity-credentials-get is permitted
          const isTopWindow = (() => {
            try {
              return window.self === window.top;
            } catch {
              return false;
            }
          })();

          const isFedCmPermitted = (() => {
            try {
              if (typeof document !== 'undefined' && 'featurePolicy' in document) {
                const fp = (document as any).featurePolicy;
                if (fp && typeof fp.allowsFeature === 'function') {
                  return fp.allowsFeature('identity-credentials-get');
                }
              }
            } catch {
              // ignore
            }
            return isTopWindow;
          })();

          // Only invoke prompt() if running in top-level window or if FedCM feature is enabled
          if (isTopWindow && isFedCmPermitted) {
            try {
              (window as any).google.accounts.id.prompt((notification: any) => {
                if (notification?.isNotDisplayed?.()) {
                  // Silent ignore when prompt is suppressed by browser policy or user choice
                }
              });
            } catch {
              // Non-critical prompt ignore
            }
          }
        }
      } catch (gsiErr) {
        console.warn('[GSI] Non-critical GSI initialization notice:', gsiErr);
      }
    };

    initGsi();

    return () => {
      isMounted = false;
      unsubscribeAuth();
    };
  }, []);

  // Google OAuth Login & Registration Handler (Direct Google OAuth, No Firebase Redirect Page)
  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsGoogleLoading(true);
    setGoogleLoadingMessage('Connecting to Google... Please select your account.');

    // 1. Direct Google Identity Services (GIS) OAuth2 Client - Never visits *.firebaseapp.com
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: '518031039811-3k8c5t6ghlls3kpafgmp2f33gihq9217.apps.googleusercontent.com',
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              setIsGoogleLoading(false);
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setErrorMessage(tokenResponse.error_description || 'Google sign-in was cancelled.');
              }
              return;
            }

            if (tokenResponse?.access_token) {
              setGoogleLoadingMessage('Verifying Google credentials with SociaraX...');
              try {
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const uInfo = await userInfoRes.json();
                
                const res = await loginWithGoogle(
                  tokenResponse.access_token,
                  uInfo.email,
                  uInfo.name,
                  tokenResponse.access_token
                );

                if (res.success) {
                  setGoogleLoadingMessage('Welcome to SociaraX! Entering your dashboard...');
                  setSuccessMessage('Successfully signed in with Google!');
                  // Silent background Firebase Auth sync without any popups or redirects
                  try {
                    const cred = GoogleAuthProvider.credential(null, tokenResponse.access_token);
                    await signInWithCredential(auth, cred);
                  } catch (syncErr) {
                    console.warn('[FIREBASE SYNC]', syncErr);
                  }
                } else {
                  setErrorMessage(res.error || 'Failed to authenticate Google account.');
                }
              } catch (err: any) {
                console.error('[GOOGLE AUTH ERROR]:', err);
                setErrorMessage('Failed to connect to Google. Please try again.');
              } finally {
                setIsGoogleLoading(false);
              }
            }
          }
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (gsiErr) {
        console.warn('[GSI] Direct token client error, falling back to popup:', gsiErr);
      }
    }

    // 2. Fallback: Firebase signInWithPopup
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setGoogleLoadingMessage('Verifying credentials with SociaraX...');
      const idToken = await result.user.getIdToken();
      const res = await loginWithGoogle(
        idToken,
        result.user.email || undefined,
        result.user.displayName || undefined
      );

      if (res.success) {
        setGoogleLoadingMessage('Welcome to SociaraX! Entering your dashboard...');
        setSuccessMessage('Successfully signed in with Google!');
        setIsGoogleLoading(false);
      } else {
        setIsGoogleLoading(false);
        setErrorMessage(res.error || 'Failed to authenticate Google account with SociaraX server.');
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        console.warn('[AUTH] Google popup blocked by browser policy, attempting redirect flow');
        setGoogleLoadingMessage('Redirecting to Google sign-in...');
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          setIsGoogleLoading(false);
          setErrorMessage('Could not open sign-in window. Please allow popups or use manual login.');
        }
      } else if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setIsGoogleLoading(false);
        setErrorMessage('Sign-in window was closed before completion. Click "Sign in with Google" to try again.');
      } else if (err?.code === 'auth/network-request-failed') {
        setIsGoogleLoading(false);
        setErrorMessage('Network connection failure. Please check your internet connection.');
      } else {
        setIsGoogleLoading(false);
        console.warn('[AUTH] Google sign-in notice:', err?.message || err);
        setErrorMessage(err?.message || 'Google sign-in encountered an error. Please try again.');
      }
    }
  };

  // Step 1: Check account and request OTP
  const handleCheckAccountAndRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotIdentifier.trim()) {
      setForgotError('Please enter your username or registered email address.');
      return;
    }

    setForgotLoading(true);

    // If channels haven't been fetched yet, check account first
    if (forgotChannels.length === 0) {
      const checkRes = await checkAccountForOtp(forgotIdentifier.trim());
      if (!checkRes.success) {
        setForgotLoading(false);
        setForgotError(checkRes.error || 'Account not found. Please verify spelling.');
        return;
      }

      if (checkRes.channels && checkRes.channels.length > 0) {
        setForgotChannels(checkRes.channels);
        setSelectedChannel(checkRes.channels[0].id);
      }
    }

    // Request OTP to selected channel
    const otpRes = await requestPasswordResetOtp(forgotIdentifier.trim(), selectedChannel);
    setForgotLoading(false);

    if (otpRes.success) {
      setForgotSuccess(otpRes.message || 'OTP verification code sent successfully!');
      setForgotStep('verify_otp');
      setResendCooldown(60); // 60s cooldown
    } else {
      setForgotError(otpRes.error || 'Failed to dispatch OTP code. Please try again.');
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);

    const otpRes = await requestPasswordResetOtp(forgotIdentifier.trim(), selectedChannel);
    setForgotLoading(false);

    if (otpRes.success) {
      setForgotSuccess('New OTP verification code sent successfully!');
      setResendCooldown(60);
    } else {
      setForgotError(otpRes.error || 'Failed to resend OTP.');
    }
  };

  // Step 2: Verify OTP and Reset Password
  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!otpCode.trim()) {
      setForgotError('Please enter the 6-digit OTP code received.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotError('New password and confirmation do not match.');
      return;
    }

    setForgotLoading(true);
    const res = await verifyOtpAndResetPassword(
      forgotIdentifier.trim(),
      otpCode.trim(),
      newPassword,
      confirmNewPassword
    );
    setForgotLoading(false);

    if (res.success) {
      setForgotSuccess('Identity verified & Password updated successfully! Entering dashboard...');
      setTimeout(() => {
        setIsForgotModalOpen(false);
      }, 1200);
    } else {
      setForgotError(res.error || 'Invalid or expired OTP code.');
    }
  };

  const hasCustomBg = Boolean(
    settings?.custom_background_image_url && 
    (settings.background_apply_to === 'all' || settings.background_apply_to === 'auth_only' || !settings.background_apply_to)
  );

  return (
    <div id="authgate-root" className={`w-full max-w-[100vw] min-h-screen ${hasCustomBg ? 'bg-slate-950/75' : 'bg-slate-950'} text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white overflow-x-hidden relative`}>
      {/* Dynamic Background Image (Configured via Admin Panel) */}
      {hasCustomBg && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
            style={{
              backgroundImage: `url("${settings.custom_background_image_url}")`,
              filter: settings.background_blur === 'md' ? 'blur(8px)' : settings.background_blur === 'sm' ? 'blur(4px)' : 'none',
              transform: settings.background_blur && settings.background_blur !== 'none' ? 'scale(1.05)' : 'none'
            }}
          />
          <div 
            className="absolute inset-0 bg-slate-950 transition-opacity duration-300"
            style={{
              opacity: parseFloat(settings.background_overlay_opacity || '0.70')
            }}
          />
        </div>
      )}

      {/* Full-Screen Branded Loading State for Google Sign-In */}
      {isGoogleLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-6 text-center animate-in fade-in duration-200">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-2xl shadow-indigo-600/50 animate-pulse">
              <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                {/* Google G */}
                <svg className="w-10 h-10" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Google Sign-In</h3>
          <p className="text-xs text-slate-300 max-w-sm mb-5 leading-relaxed">
            {googleLoadingMessage || 'Connecting with your Google Account...'}
          </p>

          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6">
            <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Secure connection active...</span>
          </div>

          <button
            type="button"
            onClick={() => setIsGoogleLoading(false)}
            className="text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer transition-colors"
          >
            Cancel sign-in
          </button>
        </div>
      )}
      
      {/* Top Header */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 overflow-hidden">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl text-white tracking-tight truncate">SociaraX</span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                  SMM
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate hidden xs:block">Enterprise Growth Portal</p>
            </div>
          </div>

          {/* Top Right Label */}
          <div className="flex items-center gap-2 shrink-0">
            <span id="auth-header-label" className="text-xs sm:text-sm font-bold text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 tracking-wide">
              SociaraX
            </span>
          </div>
        </div>
      </header>

      {/* Main Hero & Auth Section */}
      <main className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col items-center justify-start gap-8 overflow-x-hidden">
        
        {/* SECTION 1: Sign In / Register Account Card (AT THE TOP) */}
        <div className="w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
            
            {/* Glow Accent */}
            <div className="absolute -top-24 -right-24 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Mode Switcher: Register or Sign In */}
            <div className="space-y-4 mb-5">
              <div className="grid grid-cols-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 gap-1.5">
                <button
                  id="tab-btn-login"
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer truncate ${
                    mode === 'login'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  id="tab-btn-register"
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer truncate ${
                    mode === 'register'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register Account
                </button>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {mode === 'register' ? 'Create Your Account' : 'Welcome Back'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {mode === 'register' 
                    ? 'Register in seconds to access services, wallet balance, and order tracking.' 
                    : 'Enter your username or email address and password to sign in.'}
                </p>
              </div>
            </div>

            {/* Alerts */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* Google Authentication Button */}
            <div className="mb-4 space-y-2.5">
              <button
                id="btn-google-auth"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-700/90 hover:border-slate-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md shadow-black/20 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>{mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
              </button>

              <div className="relative flex items-center justify-center pt-1">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500 absolute">
                  Or continue with {mode === 'login' ? 'credentials' : 'registration'}
                </span>
              </div>
            </div>

            {/* 1. Registration Form */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="register-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="Choose a username"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="register-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    WhatsApp / Mobile No. <span className="text-slate-500 font-normal">(Optional for OTP & Support)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="register-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 234 567 8900"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 chars"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Confirm Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        id="register-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-xs text-slate-400">
                      I agree to Terms of Service
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                <button
                  id="btn-submit-register"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Register & Enter Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 2. Login Form */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username or Email Address
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="login-identifier"
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Username or email address"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Forgot Password trigger */}
                <div className="flex items-center justify-between pt-0.5">
                  <button
                    id="btn-forgot-password"
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Forgot Password? (OTP Verification)</span>
                  </button>
                </div>

                <button
                  id="btn-submit-login"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Secure guarantee */}
            <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>256-Bit Encrypted Portal</span>
              </div>
              <div>Status: <span className="text-emerald-400 font-semibold">Active</span></div>
            </div>
          </div>
        </div>

        {/* SECTION 2: SociaraX Introductory Section & Fulfillment Networks (Directly BELOW Sign In to Dashboard) */}
        <div className="w-full space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold max-w-full">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Automated SMM Infrastructure & Instant API Engine</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">SociaraX</span>.
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Non-drop social media growth services, real-time automated order fulfillment, multi-gateway INR payments, and direct owner WhatsApp/Telegram support.
            </p>
          </div>

          {/* Supported Networks Showcase */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Active Automated Fulfillment Networks</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400 font-semibold flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5" /> Instagram Followers & Reels
              </span>
              <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold flex items-center gap-1.5">
                <Youtube className="w-3.5 h-3.5" /> YouTube Watch Time & Subs
              </span>
              <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" /> Telegram Channel Members
              </span>
              <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-semibold flex items-center gap-1.5">
                <Ghost className="w-3.5 h-3.5" /> Snapchat Spotlight & Views
              </span>
              <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 font-semibold flex items-center gap-1.5">
                <Twitter className="w-3.5 h-3.5" /> Twitter / X Retweets
              </span>
              <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" /> TikTok & Spotify
              </span>
            </div>
          </div>

          {/* Official Support Team Contacts Card */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>24/7 Official Support Helpdesk</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <a
                href={settings?.telegram_support?.startsWith('http') ? settings.telegram_support : `https://t.me/${(settings?.telegram_support || 'SociaraXSupport').replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-sky-500/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-400 text-[10px]">Telegram Support</div>
                    <div className="text-white font-bold group-hover:text-sky-400 transition-colors truncate">
                      {settings?.telegram_support || '@SociaraXSupport'}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-400 shrink-0 ml-2" />
              </a>

              <a
                href={settings?.whatsapp_support?.startsWith('http') ? settings.whatsapp_support : `https://wa.me/${(settings?.whatsapp_support || '').replace(/[^0-9]/g, '') || '919876543210'}?text=Hello%20SociaraX%20Support`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-400 text-[10px]">WhatsApp Support</div>
                    <div className="text-white font-bold group-hover:text-emerald-400 transition-colors truncate">
                      {settings?.whatsapp_support || '@SociaraXDirect'}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 shrink-0 ml-2" />
              </a>
            </div>
          </div>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* SECURE OTP FORGOT PASSWORD MODAL */}
      {/* ========================================================================= */}
      {isForgotModalOpen && (
        <div id="forgot-password-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl max-w-md w-full relative overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {forgotStep === 'reset_with_token' ? 'Secure Password Reset' : 'Reset Password'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {forgotStep === 'reset_with_token'
                      ? 'Choose your new secure account password'
                      : forgotStep === 'identify' 
                      ? 'Step 1: Choose delivery channel for reset instructions' 
                      : 'Step 2: Enter 6-digit code or click email reset button'}
                  </p>
                </div>
              </div>

              <button
                id="btn-close-forgot-modal"
                type="button"
                onClick={closeForgotPassword}
                className="w-8 h-8 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error & Success banners */}
            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="leading-relaxed">{forgotSuccess}</span>
              </div>
            )}

            {/* Step: Reset With Token (Direct from Email Link) */}
            {forgotStep === 'reset_with_token' && (
              <form onSubmit={handleResetWithToken} className="space-y-4">
                {tokenAccountInfo && (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between">
                    <span className="text-slate-400">Account:</span>
                    <span className="font-bold text-indigo-300">
                      {tokenAccountInfo.username ? `@${tokenAccountInfo.username}` : ''} {tokenAccountInfo.maskedEmail ? `(${tokenAccountInfo.maskedEmail})` : ''}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      New Password <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showNewPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="token-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirm New Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="token-confirm-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={closeForgotPassword}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    id="btn-reset-token-submit"
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Update Password & Log In</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 1: Identify Account & Select Channel */}
            {forgotStep === 'identify' && (
              <form onSubmit={handleCheckAccountAndRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Registered Username or Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="forgot-identifier-input"
                      type="text"
                      required
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="Username or email address"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Channel selection if already discovered */}
                {forgotChannels.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <label className="block text-xs font-semibold text-indigo-300">
                      Select Delivery Method for 6-Digit OTP Code:
                    </label>
                    <div className="space-y-2">
                      {forgotChannels.map((ch) => (
                        <label
                          key={ch.id}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedChannel === ch.id
                              ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="otp_channel"
                              checked={selectedChannel === ch.id}
                              onChange={() => setSelectedChannel(ch.id)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                {ch.id === 'email' ? <Mail className="w-3.5 h-3.5 text-indigo-400" /> : <Phone className="w-3.5 h-3.5 text-emerald-400" />}
                                <span>{ch.label}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">{ch.masked}</div>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {ch.id === 'email' ? 'Email OTP' : 'WhatsApp/SMS'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={closeForgotPassword}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    id="btn-send-otp"
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Send 6-Digit OTP</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Verify OTP & Enter New Password */}
            {forgotStep === 'verify_otp' && (
              <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Enter 6-Digit OTP Code <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || forgotLoading}
                      onClick={handleResendOtp}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="otp-code-input"
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="e.g. 849201"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-base font-mono tracking-widest text-center text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      New Password <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showNewPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="otp-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirm New Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="otp-confirm-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setForgotStep('identify')}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    id="btn-verify-otp-submit"
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify OTP & Set Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 py-5 text-xs text-slate-500 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            © {new Date().getFullYear()} SociaraX. All rights reserved. Automated SMM provider engine.
          </div>

          <div className="flex items-center gap-4 text-slate-600">
            <span>256-Bit SSL Protected</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
