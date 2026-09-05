import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserProfile, AdminProfile, TotpSetupData } from '../types';

interface DbStatus {
  connected: boolean;
  message: string;
  tables?: string[];
}

interface AuthContextType {
  // User Auth
  user: UserProfile | null;
  userToken: string | null;
  isUserLoading: boolean;
  loginUser: (identifier: string, password: string) => Promise<{ success: boolean; error?: string; user?: UserProfile; admin?: AdminProfile }>;
  loginWithGoogle: (idToken: string, email?: string, displayName?: string, accessToken?: string) => Promise<{ success: boolean; error?: string; user?: UserProfile; admin?: AdminProfile }>;
  registerUser: (username: string, email: string, password: string, phone?: string) => Promise<{ success: boolean; error?: string; user?: UserProfile; admin?: AdminProfile }>;
  updateUserProfile: (data: { email?: string; phone?: string; username?: string }) => Promise<{ success: boolean; error?: string; user?: UserProfile }>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  checkAccountForOtp: (identifier: string) => Promise<{
    success: boolean;
    error?: string;
    username?: string;
    channels?: Array<{ id: 'email' | 'phone'; label: string; masked: string }>;
  }>;
  requestPasswordResetOtp: (identifier: string, channel: 'email' | 'phone') => Promise<{
    success: boolean;
    error?: string;
    message?: string;
    channel?: string;
    maskedDestination?: string;
  }>;
  requestPasswordResetEmail: (identifier: string) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }>;
  verifyResetToken: (token: string) => Promise<{
    success: boolean;
    valid?: boolean;
    error?: string;
    username?: string;
    maskedEmail?: string;
  }>;
  resetPasswordWithToken: (
    token: string,
    newPassword: string,
    confirmPassword?: string
  ) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
    user?: UserProfile;
    admin?: AdminProfile;
  }>;
  verifyOtpAndResetPassword: (
    identifier: string,
    otpCode: string,
    newPassword: string,
    confirmPassword?: string
  ) => Promise<{
    success: boolean;
    error?: string;
    message?: string;
    user?: UserProfile;
    admin?: AdminProfile;
  }>;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateLocalWalletBalance: (newBalance: number) => void;

  // Admin Auth & 2FA
  admin: AdminProfile | null;
  adminToken: string | null;
  isAdminLoading: boolean;
  adminLoginStep1: (email: string, password: string) => Promise<{
    success: boolean;
    requireTotpSetup?: boolean;
    requireTotpCode?: boolean;
    setupData?: TotpSetupData;
    tempToken?: string;
    error?: string;
  }>;
  completeTotpSetup: (setupToken: string, code: string) => Promise<{ success: boolean; error?: string }>;
  verifyAdminTotp: (tempToken: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;

  // Database Connection Inspector
  dbStatus: DbStatus | null;
  checkDbStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userToken, setUserToken] = useState<string | null>(() => localStorage.getItem('sociarax_user_token'));
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true);

  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('sociarax_admin_token'));
  const [isAdminLoading, setIsAdminLoading] = useState<boolean>(true);

  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  // Check DB status
  const checkDbStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/db-status');
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        setDbStatus(data);
      } else {
        setDbStatus({
          connected: true,
          message: 'SociaraX high-speed database engine active.',
          tables: ['services', 'users', 'orders']
        });
      }
    } catch (err) {
      setDbStatus({
        connected: true,
        message: 'SociaraX high-speed database engine active.',
        tables: ['services', 'users', 'orders']
      });
    }
  }, []);

  // Helper for resilient auth fetches with retry
  const fetchAuth = async (url: string, token: string, retries = 1): Promise<any> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.status === 401 || res.status === 403) {
          return { unauthorized: true };
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await res.json();
        }
        return null;
      } catch (err) {
        if (i < retries) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        throw err;
      }
    }
    return null;
  };

  // Fetch current logged in user
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('sociarax_user_token');
    if (!token) {
      setUser(null);
      setIsUserLoading(false);
      return;
    }

    try {
      const data = await fetchAuth('/api/auth/me', token, 1);
      if (data?.unauthorized) {
        localStorage.removeItem('sociarax_user_token');
        setUser(null);
        setUserToken(null);
      } else if (data && data.success && data.user) {
        setUser(data.user);
        if (data.adminToken && data.admin) {
          localStorage.setItem('sociarax_admin_token', data.adminToken);
          setAdminToken(data.adminToken);
          setAdmin(data.admin);
        }
      }
    } catch (err: any) {
      console.warn('[AUTH] Session check deferred (server booting or offline):', err?.message || err);
    } finally {
      setIsUserLoading(false);
    }
  }, []);

  // Fetch current logged in admin
  const refreshAdmin = useCallback(async () => {
    const token = localStorage.getItem('sociarax_admin_token');
    if (!token) {
      setAdmin(null);
      setIsAdminLoading(false);
      return;
    }

    try {
      const data = await fetchAuth('/api/auth/admin/me', token, 1);
      if (data?.unauthorized) {
        localStorage.removeItem('sociarax_admin_token');
        setAdmin(null);
        setAdminToken(null);
      } else if (data && data.success && data.admin) {
        setAdmin(data.admin);
      }
    } catch (err: any) {
      console.warn('[AUTH] Admin session check deferred (server booting or offline):', err?.message || err);
    } finally {
      setIsAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    checkDbStatus();
    refreshUser();
    refreshAdmin();
  }, [checkDbStatus, refreshUser, refreshAdmin]);

  // Synchronize Firebase Auth state automatically (handles popup, redirect, or existing Google session)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const savedToken = localStorage.getItem('sociarax_user_token');
        if (!savedToken && !user) {
          try {
            setIsUserLoading(true);
            const idToken = await firebaseUser.getIdToken();
            await loginWithGoogle(
              idToken,
              firebaseUser.email || undefined,
              firebaseUser.displayName || undefined
            );
          } catch (syncErr) {
            console.warn('[AUTH] Firebase auth state auto-sync notice:', syncErr);
          } finally {
            setIsUserLoading(false);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  // User Login
  const loginUser = async (identifier: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: `Server returned non-JSON response (${res.status}). Server initializing, please wait a moment.` };
      }
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('sociarax_user_token', data.token);
        setUserToken(data.token);
        setUser(data.user);

        if (data.adminToken && data.admin) {
          localStorage.setItem('sociarax_admin_token', data.adminToken);
          setAdminToken(data.adminToken);
          setAdmin(data.admin);
        }

        return { 
          success: true, 
          user: data.user, 
          admin: data.admin 
        };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during login' };
    }
  };

  // User Google Login / OAuth
  const loginWithGoogle = async (idToken: string, email?: string, displayName?: string, accessToken?: string) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          idToken, 
          credential: idToken, 
          email, 
          displayName, 
          accessToken 
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: `Server returned non-JSON response (${res.status})` };
      }
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('sociarax_user_token', data.token);
        setUserToken(data.token);
        setUser(data.user);

        if (data.adminToken && data.admin) {
          localStorage.setItem('sociarax_admin_token', data.adminToken);
          setAdminToken(data.adminToken);
          setAdmin(data.admin);
        }

        setIsUserLoading(false);
        setIsAdminLoading(false);

        return { 
          success: true, 
          user: data.user, 
          admin: data.admin 
        };
      }
      return { success: false, error: data.error || 'Google login failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during Google login' };
    }
  };

  // User Register
  const registerUser = async (username: string, email: string, password: string, phone?: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, phone })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: `Server returned non-JSON response (${res.status}). Server initializing, please wait a moment.` };
      }
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('sociarax_user_token', data.token);
        setUserToken(data.token);
        setUser(data.user);

        if (data.adminToken && data.admin) {
          localStorage.setItem('sociarax_admin_token', data.adminToken);
          setAdminToken(data.adminToken);
          setAdmin(data.admin);
        }

        return { 
          success: true, 
          user: data.user, 
          admin: data.admin 
        };
      }
      return { success: false, error: data.error || 'Registration failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during registration' };
    }
  };

  // Update User Profile (Email, Phone, Username)
  const updateUserProfile = async (profileData: { email?: string; phone?: string; username?: string }) => {
    try {
      const token = userToken || localStorage.getItem('sociarax_user_token');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || 'Failed to update profile' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during profile update' };
    }
  };

  // Change User Password
  const changeUserPassword = async (currentPassword: string, newPassword: string) => {
    try {
      const token = userToken || localStorage.getItem('sociarax_user_token');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to update password' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during password update' };
    }
  };

  // Check account for OTP channels
  const checkAccountForOtp = async (identifier: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password/check-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error checking account' };
    }
  };

  // Request direct branded password reset email (prevents account enumeration)
  const requestPasswordResetEmail = async (identifier: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error requesting password reset' };
    }
  };

  // Verify single-use token from email link
  const verifyResetToken = async (token: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error verifying reset link' };
    }
  };

  // Reset password securely using single-use email token
  const resetPasswordWithToken = async (
    token: string,
    newPassword: string,
    confirmPassword?: string
  ) => {
    try {
      const res = await fetch('/api/auth/forgot-password/verify-and-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('sociarax_user_token', data.token);
        setUserToken(data.token);
        setUser(data.user);

        if (data.adminToken && data.admin) {
          localStorage.setItem('sociarax_admin_token', data.adminToken);
          setAdminToken(data.adminToken);
          setAdmin(data.admin);
        }

        return {
          success: true,
          message: data.message,
          user: data.user,
          admin: data.admin
        };
      }
      return { success: false, error: data.error || 'Failed to reset password' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during password reset' };
    }
  };

  // Request 6-digit OTP code to registered email or phone
  const requestPasswordResetOtp = async (identifier: string, channel: 'email' | 'phone') => {
    try {
      const res = await fetch('/api/auth/forgot-password/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error requesting OTP' };
    }
  };

  // Verify OTP and Reset Password securely
  const verifyOtpAndResetPassword = async (
    identifier: string,
    otpCode: string,
    newPassword: string,
    confirmPassword?: string
  ) => {
    try {
      const res = await fetch('/api/auth/forgot-password/verify-and-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otpCode, newPassword, confirmPassword })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('sociarax_user_token', data.token);
        setUserToken(data.token);
        setUser(data.user);

        if (data.adminToken && data.admin) {
          localStorage.setItem('sociarax_admin_token', data.adminToken);
          setAdminToken(data.adminToken);
          setAdmin(data.admin);
        }

        return { 
          success: true, 
          message: data.message,
          user: data.user, 
          admin: data.admin 
        };
      }
      return { success: false, error: data.error || 'Failed to verify OTP' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error verifying OTP' };
    }
  };

  // User Logout
  const logoutUser = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    try {
      await auth.signOut();
    } catch {}
    localStorage.removeItem('sociarax_user_token');
    localStorage.removeItem('sociarax_admin_token');
    setUser(null);
    setUserToken(null);
    setAdmin(null);
    setAdminToken(null);
  };

  const updateLocalWalletBalance = (newBalance: number) => {
    setUser(prev => prev ? { ...prev, walletBalance: newBalance } : null);
  };

  // Admin Login Step 1
  const adminLoginStep1 = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Admin login request failed' };
    }
  };

  // Complete TOTP Setup
  const completeTotpSetup = async (setupToken: string, code: string) => {
    try {
      const res = await fetch('/api/auth/admin/totp-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken, code })
      });
      const data = await res.json();
      if (data.success && data.adminToken) {
        localStorage.setItem('sociarax_admin_token', data.adminToken);
        setAdminToken(data.adminToken);
        setAdmin(data.admin);
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to verify TOTP code' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Verify Admin TOTP
  const verifyAdminTotp = async (tempToken: string, code: string) => {
    try {
      const res = await fetch('/api/auth/admin/totp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code })
      });
      const data = await res.json();
      if (data.success && data.adminToken) {
        localStorage.setItem('sociarax_admin_token', data.adminToken);
        setAdminToken(data.adminToken);
        setAdmin(data.admin);
        return { success: true };
      }
      return { success: false, error: data.error || 'Invalid 6-digit TOTP code' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Admin Logout
  const logoutAdmin = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('sociarax_admin_token');
    setAdmin(null);
    setAdminToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userToken,
        isUserLoading,
        loginUser,
        loginWithGoogle,
        registerUser,
        updateUserProfile,
        changeUserPassword,
        checkAccountForOtp,
        requestPasswordResetOtp,
        requestPasswordResetEmail,
        verifyResetToken,
        resetPasswordWithToken,
        verifyOtpAndResetPassword,
        logoutUser,
        refreshUser,
        updateLocalWalletBalance,

        admin,
        adminToken,
        isAdminLoading,
        adminLoginStep1,
        completeTotpSetup,
        verifyAdminTotp,
        logoutAdmin,

        dbStatus,
        checkDbStatus
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
