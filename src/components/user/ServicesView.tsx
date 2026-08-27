import React, { useState, useMemo, useEffect } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { PlatformBadge } from '../Badges';
import { 
  Search, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  Filter,
  CheckCircle2,
  XCircle
} from 'lucide-react';

interface ServicesViewProps {
  onSelectServiceForOrder: (serviceId: number) => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({ onSelectServiceForOrder }) => {
  const { services, formatCurrency, isServicesLoading } = useSociarax();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Platforms available
  const platforms = useMemo(() => {
    const set = new Set(services.map(s => s.platform.toLowerCase()));
    return ['all', ...Array.from(set)];
  }, [services]);

  // Categories available based on platform
  const categories = useMemo(() => {
    let list = services;
    if (selectedPlatform !== 'all') {
      list = list.filter(s => s.platform.toLowerCase() === selectedPlatform.toLowerCase());
    }
    return ['all', ...Array.from(new Set(list.map(s => s.category)))];
  }, [services, selectedPlatform]);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter(srv => {
      const matchPlatform = selectedPlatform === 'all' || srv.platform.toLowerCase() === selectedPlatform.toLowerCase();
      const matchCategory = selectedCategory === 'all' || srv.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || 
        srv.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        srv.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(srv.id).includes(searchQuery);

      return matchPlatform && matchCategory && matchSearch;
    });
  }, [services, selectedPlatform, selectedCategory, searchQuery]);

  // Pagination Math
  const totalPages = Math.ceil(filteredServices.length / pageSize) || 1;
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPlatform, selectedCategory, searchQuery, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <span>Services Catalog</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Explore {services.length} high-speed services across Instagram, YouTube, Facebook, and more.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, name or type..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Filter Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {platforms.map(p => (
          <button
            key={p}
            onClick={() => { setSelectedPlatform(p); setSelectedCategory('all'); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
              selectedPlatform === p
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
            }`}
          >
            {p === 'all' ? 'All Platforms' : p}
          </button>
        ))}
      </div>

      {/* Category Dropdown if platform selected */}
      {categories.length > 2 && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
          >
            {categories.map(c => (
              <option key={c} value={c} className="bg-slate-950 text-white">
                {c === 'all' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Services Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {isServicesLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Loading SociaraX service database...</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-base font-semibold text-slate-300">No services match your filters</p>
            <p className="text-xs text-slate-500 mt-1">Try clearing your search or selecting a different platform.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Service Name</th>
                  <th className="py-3.5 px-4">Rate / 1000</th>
                  <th className="py-3.5 px-4">Min / Max</th>
                  <th className="py-3.5 px-4">Avg Speed</th>
                  <th className="py-3.5 px-4">Refill</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedServices.map(srv => (
                  <tr key={srv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                      #{srv.id}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <PlatformBadge platform={srv.platform} />
                        <span className="text-[11px] text-slate-400 truncate">{srv.category}</span>
                      </div>
                      <div className="font-semibold text-slate-100">{srv.name}</div>
                      {srv.description && (
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {srv.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-emerald-400 font-mono text-sm">
                        {formatCurrency(srv.rate)}
                      </div>
                      <span className="text-[10px] text-slate-500">per 1k</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      <div>{srv.min.toLocaleString()}</div>
                      <div className="text-[11px] text-slate-500">{srv.max.toLocaleString()}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{srv.averageTime || 'Instant'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {srv.refill ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>30d Refill</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>No Refill</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onSelectServiceForOrder(srv.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                      >
                        <span>Order</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* User Catalog Pagination Bar */}
        {filteredServices.length > pageSize && (
          <div className="bg-slate-950 px-5 py-3.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-white">{Math.min(currentPage * pageSize, filteredServices.length)}</strong> of <strong className="text-white">{filteredServices.length.toLocaleString()}</strong> services
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
