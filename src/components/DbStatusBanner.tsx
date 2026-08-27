import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Database, AlertTriangle, CheckCircle2, X, RefreshCw } from 'lucide-react';

export const DbStatusBanner: React.FC = () => {
  const { dbStatus, checkDbStatus } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  if (isDismissed || !dbStatus) return null;

  const handleRefresh = async () => {
    setIsChecking(true);
    await checkDbStatus();
    setIsChecking(false);
  };

  if (!dbStatus.connected) {
    return (
      <div className="bg-amber-950/80 border-b border-amber-500/30 text-amber-200 px-4 py-2.5 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="font-semibold text-amber-300">Database Setup Required:</strong> {dbStatus.message}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isChecking}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-amber-400 hover:text-amber-200 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
