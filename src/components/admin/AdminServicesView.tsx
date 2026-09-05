import React, { useState, useMemo, useEffect } from 'react';
import { useSociarax } from '../../context/SociaraxContext';
import { AdminService } from '../../types';
import { PlatformBadge } from '../Badges';
import { 
  Sparkles, 
  Search, 
  RefreshCw, 
  Plus, 
  Edit3, 
  Trash2,
  Server, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  DollarSign, 
  X,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Power
} from 'lucide-react';

export const AdminServicesView: React.FC = () => {
  const { 
    adminServices, 
    formatCurrency, 
    isServicesLoading, 
    loadAdminServices, 
    createAdminService,
    updateAdminService, 
    deleteAdminService,
    toggleAdminServiceStatus,
    syncProviderServices, 
    adminProviders 
  } = useSociarax();

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Sync Modal State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [syncMarkupPct, setSyncMarkupPct] = useState(30);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Add Service Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPlatform, setAddPlatform] = useState('instagram');
  const [addCategory, setAddCategory] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addProviderId, setAddProviderId] = useState<number | ''>(adminProviders[0]?.id || 1);
  const [addProviderServiceId, setAddProviderServiceId] = useState('');
  const [addProviderRate, setAddProviderRate] = useState<number>(100);
  const [addMarkupPct, setAddMarkupPct] = useState<number>(30);
  const [addSellingRate, setAddSellingRate] = useState<number>(130);
  const [addMinQty, setAddMinQty] = useState<number>(10);
  const [addMaxQty, setAddMaxQty] = useState<number>(50000);
  const [addRefill, setAddRefill] = useState<boolean>(true);
  const [addCancel, setAddCancel] = useState<boolean>(false);
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');
  const [isAdding, setIsAdding] = useState(false);

  // Edit Service State
  const [editingService, setEditingService] = useState<AdminService | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSellingRate, setEditSellingRate] = useState<number>(0);
  const [editMarkupPct, setEditMarkupPct] = useState<number>(30);
  const [editMinQty, setEditMinQty] = useState<number>(10);
  const [editMaxQty, setEditMaxQty] = useState<number>(10000);
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation State
  const [deletingService, setDeletingService] = useState<AdminService | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Always load admin services on mount
  useEffect(() => {
    loadAdminServices();
  }, [loadAdminServices]);

  // Extract distinct platforms and categories
  const availablePlatforms = useMemo(() => {
    const counts: Record<string, number> = {};
    adminServices.forEach(s => {
      const p = s.platform.toLowerCase();
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [adminServices]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    adminServices.forEach(s => {
      if (platformFilter === 'all' || s.platform.toLowerCase() === platformFilter.toLowerCase()) {
        set.add(s.category);
      }
    });
    return Array.from(set).sort();
  }, [adminServices, platformFilter]);

  // Open Edit Service Modal
  const handleOpenEdit = (srv: AdminService) => {
    setEditingService(srv);
    setEditName(srv.name);
    setEditCategory(srv.category);
    setEditSellingRate(srv.sellingRate);
    setEditMarkupPct(srv.markupPercentage);
    setEditMinQty(srv.min);
    setEditMaxQty(srv.max);
    setEditStatus(srv.status);
  };

  const handleEditMarkupChange = (pct: number, providerRate: number) => {
    setEditMarkupPct(pct);
    const newSelling = providerRate * (1 + pct / 100);
    setEditSellingRate(parseFloat(newSelling.toFixed(2)));
  };

  const handleEditSellingRateChange = (selling: number, providerRate: number) => {
    setEditSellingRate(selling);
    if (providerRate > 0) {
      const calculatedPct = ((selling - providerRate) / providerRate) * 100;
      setEditMarkupPct(parseFloat(calculatedPct.toFixed(1)));
    }
  };

  // Add Service Calculation
  const handleAddMarkupChange = (pct: number) => {
    setAddMarkupPct(pct);
    const newSelling = addProviderRate * (1 + pct / 100);
    setAddSellingRate(parseFloat(newSelling.toFixed(2)));
  };

  const handleAddProviderRateChange = (pRate: number) => {
    setAddProviderRate(pRate);
    const newSelling = pRate * (1 + addMarkupPct / 100);
    setAddSellingRate(parseFloat(newSelling.toFixed(2)));
  };

  const handleAddSellingRateChange = (sRate: number) => {
    setAddSellingRate(sRate);
    if (addProviderRate > 0) {
      const calculatedPct = ((sRate - addProviderRate) / addProviderRate) * 100;
      setAddMarkupPct(parseFloat(calculatedPct.toFixed(1)));
    }
  };

  const handleCreateServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addCategory.trim()) return;

    setIsAdding(true);
    const res = await createAdminService({
      name: addName.trim(),
      platform: addPlatform,
      category: addCategory.trim(),
      description: addDescription.trim(),
      providerId: addProviderId || null,
      providerServiceId: addProviderServiceId.trim() || null,
      providerRate: addProviderRate,
      sellingRate: addSellingRate,
      markupPercentage: addMarkupPct,
      minQuantity: addMinQty,
      maxQuantity: addMaxQty,
      refill: addRefill,
      cancel: addCancel,
      status: addStatus
    });
    setIsAdding(false);

    if (res.success) {
      setIsAddModalOpen(false);
      setAddName('');
      setAddCategory('');
      setAddDescription('');
      setSyncNotice({ type: 'success', message: 'New service created and published successfully!' });
      setTimeout(() => setSyncNotice(null), 4000);
    } else {
      setSyncNotice({ type: 'error', message: res.error || 'Failed to create service' });
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    setIsSaving(true);
    const res = await updateAdminService(editingService.id, {
      name: editName.trim(),
      category: editCategory.trim(),
      sellingRate: editSellingRate,
      markupPercentage: editMarkupPct,
      minQuantity: editMinQty,
      maxQuantity: editMaxQty,
      status: editStatus
    });
    setIsSaving(false);

    if (res.success) {
      setEditingService(null);
      setSyncNotice({ type: 'success', message: `Service #${editingService.id} updated successfully!` });
      setTimeout(() => setSyncNotice(null), 4000);
    } else {
      setSyncNotice({ type: 'error', message: res.error || 'Failed to update service' });
    }
  };

  const handleDeleteService = async () => {
    if (!deletingService) return;
    setIsDeleting(true);
    const res = await deleteAdminService(deletingService.id);
    setIsDeleting(false);

    if (res.success) {
      setDeletingService(null);
      setSyncNotice({ type: 'success', message: res.message || 'Service deleted.' });
      setTimeout(() => setSyncNotice(null), 4000);
    } else {
      setSyncNotice({ type: 'error', message: res.error || 'Failed to delete service' });
    }
  };

  const handleToggleStatus = async (srv: AdminService) => {
    const res = await toggleAdminServiceStatus(srv.id);
    if (res.success) {
      setSyncNotice({ type: 'success', message: `Service #${srv.id} is now ${res.status}.` });
      setTimeout(() => setSyncNotice(null), 3000);
    }
  };

  const handleRunSync = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    const res = await syncProviderServices(undefined, syncMarkupPct);
    setIsSyncing(false);
    setIsSyncModalOpen(false);

    if (res.success) {
      setSyncNotice({ type: 'success', message: res.message || 'Services synchronized from provider successfully!' });
      setTimeout(() => setSyncNotice(null), 4000);
    } else {
      setSyncNotice({ type: 'error', message: res.error || 'Failed to sync provider catalog' });
    }
  };

  // Filtered Services
  const filteredServices = useMemo(() => {
    return adminServices.filter(srv => {
      const matchPlatform = platformFilter === 'all' || srv.platform.toLowerCase() === platformFilter.toLowerCase();
      const matchCategory = categoryFilter === 'all' || srv.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchStatus = statusFilter === 'all' || srv.status === statusFilter;
      const matchSearch = !searchQuery.trim() ||
        String(srv.id).includes(searchQuery) ||
        srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        srv.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (srv.providerServiceId && srv.providerServiceId.includes(searchQuery));

      return matchPlatform && matchCategory && matchStatus && matchSearch;
    });
  }, [adminServices, platformFilter, categoryFilter, statusFilter, searchQuery]);

  // Pagination Math
  const totalPages = Math.ceil(filteredServices.length / pageSize) || 1;
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [platformFilter, categoryFilter, statusFilter, searchQuery, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <span>Service Catalog & Pricing Control</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Total {adminServices.length.toLocaleString()} active services. Manage prices, profit margins, add/remove services, and upstream API sync.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadAdminServices()}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
            title="Refresh Services Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${isServicesLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Service</span>
          </button>
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Server className="w-4 h-4" />
            <span>Sync Luvsmm API</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
          syncNotice.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
        }`}>
          {syncNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
          <span>{syncNotice.message}</span>
        </div>
      )}

      {/* Platform Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => { setPlatformFilter('all'); setCategoryFilter('all'); }}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            platformFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <span>All Platforms</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
            {adminServices.length}
          </span>
        </button>
        {Object.entries(availablePlatforms).map(([p, count]) => (
          <button
            key={p}
            onClick={() => { setPlatformFilter(p); setCategoryFilter('all'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              platformFilter === p
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>{p}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Secondary Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-indigo-500 max-w-xs truncate"
            >
              <option value="all">All Categories ({availableCategories.length})</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive (Hidden)</option>
            </select>
          </div>
        </div>

        {/* Search & Page Size */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search service, name, ID..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-all"
            />
          </div>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 shrink-0"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {isServicesLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Loading catalog...</p>
          </div>
        ) : paginatedServices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-base font-semibold text-slate-300">No services match the selected criteria</p>
            <p className="text-xs text-slate-500 mt-1">Try resetting your search query or platform filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Service Name & Category</th>
                  <th className="py-3.5 px-4">Provider Cost</th>
                  <th className="py-3.5 px-4">Selling Rate</th>
                  <th className="py-3.5 px-4">Markup & Profit</th>
                  <th className="py-3.5 px-4">Min / Max</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedServices.map(srv => (
                  <tr key={srv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                      #{srv.id}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <PlatformBadge platform={srv.platform} />
                        <span className="text-[11px] text-slate-400 truncate">{srv.category}</span>
                      </div>
                      <div className="font-semibold text-white line-clamp-1">{srv.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Provider: {srv.providerName || 'Luvsmm'} {srv.providerServiceId ? `(API #${srv.providerServiceId})` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 font-bold">
                      <div>{formatCurrency(srv.providerRate)}</div>
                      {srv.providerRateUsd !== undefined && srv.providerRateUsd > 0 && (
                        <div className="text-[10px] text-slate-500 font-sans font-normal">
                          (${Number(srv.providerRateUsd).toFixed(3)} USD)
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-base">
                      {formatCurrency(srv.sellingRate)}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-emerald-400 font-bold">+{formatCurrency(srv.profitPer1000)} / 1k</div>
                      <div className="text-[11px] text-slate-400">
                        Margin: <strong className="text-indigo-300">+{srv.markupPercentage}%</strong>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 text-xs">
                      <div>Min: {srv.min.toLocaleString()}</div>
                      <div className="text-slate-500">Max: {srv.max.toLocaleString()}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(srv)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          srv.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                        title="Click to toggle active / inactive"
                      >
                        <Power className="w-3 h-3" />
                        <span className="capitalize">{srv.status}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(srv)}
                          className="p-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl transition-colors cursor-pointer"
                          title="Edit Service & Pricing"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingService(srv)}
                          className="p-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                          title="Delete Service"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredServices.length > pageSize && (
          <div className="bg-slate-950 px-5 py-3.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-white">{Math.min(currentPage * pageSize, filteredServices.length)}</strong> of <strong className="text-white">{filteredServices.length.toLocaleString()}</strong> services
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Service Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>Create New SMM Service</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Add a new service to SociaraX catalog with custom selling rates and automatic margins.
            </p>

            <form onSubmit={handleCreateServiceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Service Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Instagram Followers [Real & Active - 30 Days Refill]"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Platform <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={addPlatform}
                    onChange={(e) => setAddPlatform(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500 capitalize"
                  >
                    {['instagram', 'youtube', 'facebook', 'telegram', 'tiktok', 'twitter', 'spotify', 'threads', 'discord', 'other'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                    placeholder="e.g. Instagram Followers Refill"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Provider & API Service ID */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Upstream Provider</label>
                  <select
                    value={addProviderId}
                    onChange={(e) => setAddProviderId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white"
                  >
                    {adminProviders.map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.name} ({pr.adapterType || 'API'})</option>
                    ))}
                    <option value="">Manual Execution</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Provider Service ID</label>
                  <input
                    type="text"
                    value={addProviderServiceId}
                    onChange={(e) => setAddProviderServiceId(e.target.value)}
                    placeholder="e.g. 1042"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
                  />
                </div>
              </div>

              {/* Pricing & Markup Section */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Pricing & Profit Engine (Per 1,000 Units)
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Provider Cost (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={addProviderRate}
                      onChange={(e) => handleAddProviderRateChange(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-rose-400 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Markup (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={addMarkupPct}
                      onChange={(e) => handleAddMarkupChange(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-indigo-300 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Selling Rate (₹)</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={addSellingRate}
                      onChange={(e) => handleAddSellingRateChange(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-emerald-400/90 font-mono flex items-center justify-between">
                  <span>Net Profit per 1,000 orders:</span>
                  <span className="font-bold">+{formatCurrency(Math.max(0, addSellingRate - addProviderRate))}</span>
                </div>
              </div>

              {/* Min & Max Quantities */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Min Quantity</label>
                  <input
                    type="number"
                    value={addMinQty}
                    onChange={(e) => setAddMinQty(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Max Quantity</label>
                  <input
                    type="number"
                    value={addMaxQty}
                    onChange={(e) => setAddMaxQty(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  placeholder="e.g. Put public link only. Starts instantly within 5-10 minutes."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white resize-none"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addRefill}
                    onChange={(e) => setAddRefill(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Refill Guaranteed</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addCancel}
                    onChange={(e) => setAddCancel(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Cancel Button Enabled</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isAdding}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-colors cursor-pointer mt-2"
              >
                {isAdding ? 'Creating Service...' : 'Publish New Service'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingService(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">
              Edit Service #{editingService.id}
            </h3>
            <p className="text-xs text-slate-400 mb-4 truncate">{editingService.name}</p>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 mb-5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Provider Cost ({editingService.providerName || 'API'}):</span>
              <span className="font-mono text-rose-400 font-bold">{formatCurrency(editingService.providerRate)} / 1k</span>
            </div>

            <form onSubmit={handleSaveService} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Service Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Markup Percentage (%)
                  </label>
                  <div className="relative">
                    <Percent className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="number"
                      step="any"
                      value={editMarkupPct}
                      onChange={(e) => handleEditMarkupChange(parseFloat(e.target.value) || 0, editingService.providerRate)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    SociaraX Selling Rate (₹/1k)
                  </label>
                  <div className="relative">
                    <span className="text-slate-500 absolute left-3 top-2.5 font-bold">₹</span>
                    <input
                      type="number"
                      step="any"
                      value={editSellingRate}
                      onChange={(e) => handleEditSellingRateChange(parseFloat(e.target.value) || 0, editingService.providerRate)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-sm text-emerald-400 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Min Quantity</label>
                  <input
                    type="number"
                    value={editMinQty}
                    onChange={(e) => setEditMinQty(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Max Quantity</label>
                  <input
                    type="number"
                    value={editMaxQty}
                    onChange={(e) => setEditMaxQty(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  <option value="active">Active (Visible in Customer Catalog)</option>
                  <option value="inactive">Inactive (Hidden)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Pricing Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Service Confirmation Modal */}
      {deletingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setDeletingService(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">
              Delete Service #{deletingService.id}?
            </h3>
            <p className="text-xs text-slate-300 mb-2 font-semibold">
              {deletingService.name}
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Are you sure you want to remove this service from SociaraX? This action cannot be undone.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingService(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteService}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Provider Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsSyncModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">
              Synchronize Provider Services
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Fetches all available services directly from Luvsmm API and imports new or updated rates.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Default Profit Markup Percentage (%)
                </label>
                <div className="relative">
                  <Percent className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="number"
                    value={syncMarkupPct}
                    onChange={(e) => setSyncMarkupPct(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Example: 30% markup turns a ₹10 provider rate into ₹13 customer rate.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunSync}
                disabled={isSyncing}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? 'Connecting to Luvsmm API...' : 'Start Upstream Sync'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
