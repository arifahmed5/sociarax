import React from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { PlatformBadge } from '../Badges';
import { 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  PieChart, 
  Calendar, 
  ShoppingBag, 
  RefreshCw 
} from 'lucide-react';

export const AdminReportsView: React.FC = () => {
  const { 
    adminMetrics, 
    platformBreakdown, 
    dailyTrend, 
    formatCurrency, 
    loadAdminReports 
  } = useSociarax();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <span>Financial Analytics & Reports</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real data aggregated directly from database transaction records.
          </p>
        </div>

        <button
          onClick={() => loadAdminReports()}
          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
          title="Refresh Reports"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Revenue & Profit Share */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-400" />
            <span>Revenue & Profit by Platform</span>
          </h3>

          {platformBreakdown.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No platform order data recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {platformBreakdown.map(p => {
                const maxRev = Math.max(...platformBreakdown.map(x => x.revenue), 1);
                const pct = ((p.revenue / maxRev) * 100).toFixed(0);
                return (
                  <div key={p.platform} className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={p.platform} />
                        <span className="text-xs text-slate-400 font-mono">({p.orderCount} orders)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-white font-mono">{formatCurrency(p.revenue)}</div>
                        <div className="text-[11px] text-emerald-400 font-mono">Profit: +{formatCurrency(p.profit)}</div>
                      </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 7-Day Revenue Trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Recent 7-Day Revenue & Profit Log</span>
          </h3>

          {dailyTrend.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No daily order history yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Orders</th>
                    <th className="pb-3">Revenue</th>
                    <th className="pb-3 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {dailyTrend.map(d => (
                    <tr key={d.date} className="hover:bg-slate-800/30">
                      <td className="py-3 text-slate-300 font-sans">
                        {new Date(d.date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="py-3 text-indigo-300 font-bold">{d.orders}</td>
                      <td className="py-3 text-white font-bold">{formatCurrency(d.revenue)}</td>
                      <td className="py-3 text-emerald-400 font-bold text-right">
                        +{formatCurrency(d.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
