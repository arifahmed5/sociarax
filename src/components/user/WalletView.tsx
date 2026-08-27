import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSociarax } from '../../context/SociaraxContext';
import { 
  Wallet, 
  QrCode, 
  Copy, 
  Check, 
  CreditCard, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowDownRight, 
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Info,
  Building2,
  Coins,
  ArrowRightLeft
} from 'lucide-react';

interface WalletViewProps {
  onOpenAuthModal: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onOpenAuthModal }) => {
  const { user } = useAuth();
  const { 
    userTransactions, 
    userDepositRequests, 
    formatCurrency, 
    submitDeposit, 
    loadUserTransactions,
    isPaymentsLoading,
    settings 
  } = useSociarax();

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank' | 'crypto'>('upi');
  const [amount, setAmount] = useState<number | ''>('');
  const [usdtAmount, setUsdtAmount] = useState<number | ''>('');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [payerDetails, setPayerDetails] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [copiedSecondaryUpi, setCopiedSecondaryUpi] = useState<boolean>(false);
  const [copiedBankAcc, setCopiedBankAcc] = useState<boolean>(false);
  const [copiedIfsc, setCopiedIfsc] = useState<boolean>(false);
  const [copiedUsdtAddr, setCopiedUsdtAddr] = useState<boolean>(false);

  const minDeposit = parseFloat(settings.min_deposit || '10');
  const upiId = settings.upi_id || '6001768808@axisbank';
  const secondaryUpiId = settings.upi_secondary_id || '6001768808@ybl';
  const merchantName = settings.upi_merchant_name || 'ARIF UDDIN AHMED';

  const bankName = settings.bank_name || 'State Bank of India / Axis Bank';
  const bankAccNo = settings.bank_account_number || '6001768808';
  const bankHolder = settings.bank_account_holder || 'ARIF UDDIN AHMED';
  const bankIfsc = settings.bank_ifsc_code || 'UTIB0000123';
  const bankBranch = settings.bank_branch || 'Guwahati Branch (Current A/c)';
  const bankInstructions = settings.bank_instructions || 'Transfer amount via IMPS / NEFT / RTGS and submit the UTR / Transaction Ref number below.';

  const usdtNetwork = settings.usdt_network || 'TRC20';
  const usdtWalletAddress = settings.usdt_wallet_address || 'TY2D3vWaQkG98bA7K1xVq99mZ21LuvSMM99';
  const usdtQrImage = settings.usdt_qr_image_url || '';
  const usdtToInrRate = parseFloat(settings.usdt_to_inr_rate || '92.0');
  const usdtInstructions = settings.usdt_instructions || 'Send exact USDT on the TRC20 network. Copy and paste the Transaction Hash (TXID) below.';

  // Dynamic UPI URL for QR Code
  const upiPayUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&cu=INR${amount && Number(amount) > 0 ? `&am=${Number(amount).toFixed(2)}` : ''}`;
  const upiQrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(upiPayUrl)}&margin=10`;

  const copyToClipboard = (text: string, setFn: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!user) {
      onOpenAuthModal();
      return;
    }

    const calculatedInr = paymentMethod === 'crypto'
      ? (Number(usdtAmount) * usdtToInrRate)
      : Number(amount);

    if (!calculatedInr || calculatedInr < minDeposit) {
      setErrorMessage(`Minimum deposit amount is ${formatCurrency(minDeposit)}.`);
      return;
    }

    if (!utrNumber.trim() || utrNumber.trim().length < 5) {
      setErrorMessage(
        paymentMethod === 'crypto'
          ? 'Please enter a valid Transaction Hash (TXID).'
          : 'Please enter a valid 12-digit UTR / Reference Transaction ID.'
      );
      return;
    }

    setIsSubmitting(true);
    const detailsPayload = paymentMethod === 'crypto'
      ? `USDT: ${usdtAmount} | Rate: ₹${usdtToInrRate}/$ | Sender: ${payerDetails || 'Direct Wallet'}`
      : payerDetails.trim();

    const res = await submitDeposit(
      calculatedInr,
      paymentMethod,
      utrNumber.trim(),
      detailsPayload
    );
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage(res.message || 'Deposit request submitted for verification.');
      setAmount('');
      setUsdtAmount('');
      setUtrNumber('');
      setPayerDetails('');
    } else {
      setErrorMessage(res.error || 'Failed to submit deposit. Please check transaction reference.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            <span>Add Funds & Wallet Ledger</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Instant manual approval via UPI, GooglePay, PhonePe, Paytm, and NetBanking.
          </p>
        </div>

        {user && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 flex items-center gap-4 shrink-0 shadow-lg">
            <div>
              <div className="text-xs text-slate-400">Current Balance</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {formatCurrency(user.walletBalance)}
              </div>
            </div>
            <button
              onClick={() => loadUserTransactions()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Balance"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Left Scanner / Account Details, Right Deposit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Payment Info Card */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between">
          
          {/* TAB 1: UPI / QR Code View */}
          {paymentMethod === 'upi' && (
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#5f259f] flex items-center justify-center text-white font-bold text-xs shadow-md">
                    पे
                  </div>
                  <div>
                    <div className="text-xs font-black tracking-wide text-purple-300">PhonePe / UPI</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ACCEPTED HERE</div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  0% Deposit Fee
                </span>
              </div>

              {/* PhonePe QR Card Container */}
              <div className="bg-[#0b0c10] border border-[#5f259f]/50 p-6 rounded-2xl max-w-[300px] mx-auto shadow-2xl flex flex-col items-center relative overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-[#5f259f] flex items-center justify-center text-white font-bold text-sm shadow-md">
                    पे
                  </div>
                  <span className="text-white font-black text-xl tracking-tight">
                    {settings.custom_qr_image_url ? 'UPI Scanner' : 'PhonePe'}
                  </span>
                </div>

                <div className="text-[11px] text-[#a77df5] font-black tracking-widest uppercase mb-3">
                  ACCEPTED HERE
                </div>

                <div className="text-[11px] text-slate-300 font-medium mb-3">
                  Scan with any UPI App (GPay, PhonePe, Paytm)
                </div>

                {/* QR Image with PhonePe Center Badge */}
                <div className="bg-white p-3 rounded-2xl shadow-inner relative flex flex-col items-center">
                  <img
                    src={settings.custom_qr_image_url || upiQrApiUrl}
                    alt={`UPI QR Scanner - ${merchantName}`}
                    className="w-48 h-48 object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                  {!settings.custom_qr_image_url && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-9 h-9 rounded-full bg-[#5f259f] border-2 border-white flex items-center justify-center text-white font-black text-xs shadow-lg">
                        पे
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-sm font-bold text-white tracking-wider mt-4 text-center uppercase">
                  {merchantName}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Verified Merchant VPA</span>
                </div>
              </div>

              {/* UPI ID Details Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 mt-5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Primary UPI ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-emerald-400 font-bold select-all">{upiId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(upiId, setCopiedUpi)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors cursor-pointer"
                      title="Copy Primary UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Secondary UPI ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-purple-400 font-bold select-all">{secondaryUpiId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(secondaryUpiId, setCopiedSecondaryUpi)}
                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors cursor-pointer"
                      title="Copy Secondary UPI ID"
                    >
                      {copiedSecondaryUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Payee Name:</span>
                  <span className="font-semibold text-slate-200">{merchantName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Min Deposit:</span>
                  <span className="font-mono text-white font-bold">{formatCurrency(minDeposit)}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-indigo-950/30 border border-indigo-500/20 p-3.5 rounded-xl mt-4 space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>How to add funds via UPI:</span>
                </div>
                <ol className="list-decimal list-inside text-slate-400 space-y-0.5 pl-1">
                  <li>Scan the QR code with PhonePe, GooglePay, Paytm, or BHIM.</li>
                  <li>Pay the desired amount to <strong>{merchantName}</strong>.</li>
                  <li>Copy the <strong>12-digit UTR</strong> from your receipt and submit on the right.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: Direct Bank Transfer View */}
          {paymentMethod === 'bank' && (
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black tracking-wide text-blue-300">Bank Transfer</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">IMPS / NEFT / RTGS</div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Direct A/C
                </span>
              </div>

              {/* Official Bank Account Details Card */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 border border-blue-500/40 p-5 rounded-2xl shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">Official Bank Account</div>
                  <div className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    Active
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Bank Name</div>
                    <div className="text-sm font-bold text-white">{bankName}</div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Account Holder Name</div>
                    <div className="text-sm font-bold text-slate-200">{bankHolder}</div>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Account Number</div>
                      <div className="text-base font-mono font-bold text-emerald-400 tracking-wider select-all">{bankAccNo}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankAccNo, setCopiedBankAcc)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Copy Account Number"
                    >
                      {copiedBankAcc ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">IFSC Code</div>
                      <div className="text-base font-mono font-bold text-blue-400 tracking-wider select-all">{bankIfsc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankIfsc, setCopiedIfsc)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Copy IFSC Code"
                    >
                      {copiedIfsc ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Branch & Type</div>
                    <div className="text-xs text-slate-300 font-medium">{bankBranch}</div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-blue-950/30 border border-blue-500/20 p-3.5 rounded-xl mt-4 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>How to transfer via Bank:</span>
                </div>
                <p className="text-slate-400">{bankInstructions}</p>
                <ol className="list-decimal list-inside text-slate-400 space-y-0.5 pl-1 mt-1">
                  <li>Transfer using your NetBanking / Banking App via IMPS or NEFT.</li>
                  <li>Copy the <strong>Transaction Reference / UTR Number</strong>.</li>
                  <li>Submit your deposit on the right for verification.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: USDT / Crypto View */}
          {paymentMethod === 'crypto' && (
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black tracking-wide text-emerald-300">USDT / Crypto</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{usdtNetwork} Network</div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  1 USDT = ₹{usdtToInrRate} INR
                </span>
              </div>

              {/* USDT Card */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 border border-emerald-500/40 p-5 rounded-2xl shadow-2xl flex flex-col items-center text-center space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono">
                    USDT ({usdtNetwork})
                  </span>
                  <span className="text-xs text-slate-400">TRON Blockchain</span>
                </div>

                {/* USDT QR Scanner */}
                <div className="bg-white p-3 rounded-2xl shadow-inner relative flex flex-col items-center my-1">
                  <img
                    src={usdtQrImage || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(usdtWalletAddress)}&margin=10`}
                    alt="USDT QR Address"
                    className="w-40 h-40 object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-[10px] text-emerald-800 font-bold mt-1 uppercase tracking-wider">
                    {usdtNetwork} Scan & Pay
                  </div>
                </div>

                {/* USDT Address Container */}
                <div className="w-full bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-left">
                  <div className="overflow-hidden">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Deposit Wallet Address:</div>
                    <div className="text-xs font-mono font-bold text-emerald-400 truncate select-all">
                      {usdtWalletAddress}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(usdtWalletAddress, setCopiedUsdtAddr)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Copy USDT Address"
                  >
                    {copiedUsdtAddr ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-emerald-950/30 border border-emerald-500/20 p-3.5 rounded-xl mt-4 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                  <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>How to deposit USDT:</span>
                </div>
                <p className="text-slate-400">{usdtInstructions}</p>
                <ol className="list-decimal list-inside text-slate-400 space-y-0.5 pl-1 mt-1">
                  <li>Send USDT to the above address strictly on <strong>{usdtNetwork}</strong> network.</li>
                  <li>Copy the <strong>Transaction Hash (TXID)</strong> from your crypto wallet.</li>
                  <li>Submit your deposit on the right for automated credit.</li>
                </ol>
              </div>
            </div>
          )}

        </div>

        {/* Right: Deposit Submission Form */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-400" />
              <span>Submit Payment Verification</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select your payment method, enter transaction reference details, and submit for instant wallet credit.
            </p>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleDepositSubmit} className="space-y-5">
            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                1. Select Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'upi', label: 'UPI / QR Scanner', icon: QrCode, activeColor: 'bg-indigo-600 border-indigo-500' },
                  { id: 'bank', label: 'Bank Transfer', icon: Building2, activeColor: 'bg-blue-600 border-blue-500' },
                  { id: 'crypto', label: 'USDT / Crypto', icon: Coins, activeColor: 'bg-emerald-600 border-emerald-500' },
                ].map(m => {
                  const IconComp = m.icon;
                  const isActive = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-2 text-center ${
                        isActive
                          ? `${m.activeColor} text-white shadow-lg`
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <IconComp className="w-4 h-4 shrink-0" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Inputs for INR (UPI/Bank) or USDT (Crypto) */}
            {paymentMethod !== 'crypto' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Paid Amount (INR ₹)
                </label>
                <div className="relative">
                  <span className="text-slate-500 absolute left-3.5 top-3 font-bold">₹</span>
                  <input
                    type="number"
                    required
                    min={minDeposit}
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder={`Min ${minDeposit}`}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono font-bold"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 250, 500, 1000, 2000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition-colors cursor-pointer"
                    >
                      +₹{val}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    2. Paid Amount (USDT)
                  </label>
                  <div className="relative">
                    <span className="text-slate-500 absolute left-3.5 top-3 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min={0.1}
                      step="any"
                      value={usdtAmount}
                      onChange={(e) => setUsdtAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="e.g. 10.0"
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono font-bold"
                    />
                  </div>
                </div>

                {/* USDT -> INR Live Conversion Calculation Box */}
                <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-300 font-medium">INR Wallet Credit:</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    {usdtAmount && Number(usdtAmount) > 0 
                      ? formatCurrency(Number(usdtAmount) * usdtToInrRate)
                      : '₹0.00'}
                  </div>
                </div>
              </div>
            )}

            {/* Reference Number: UTR / Bank Ref / TXID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {paymentMethod === 'crypto' 
                  ? '3. Blockchain Transaction Hash (TXID)'
                  : paymentMethod === 'bank'
                  ? '3. Bank Transaction Reference Number / IMPS UTR'
                  : '3. 12-Digit UPI UTR / Transaction ID'}
              </label>
              <input
                type="text"
                required
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder={
                  paymentMethod === 'crypto' 
                    ? 'e.g. 7f9a2b8c4d1e...'
                    : paymentMethod === 'bank'
                    ? 'e.g. IMPS/423589123456 or CMS240825...'
                    : 'e.g. 423589123456 or T240825...'
                }
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {paymentMethod === 'crypto'
                  ? 'Paste the full Transaction Hash (TXID) from your wallet transfer details.'
                  : paymentMethod === 'bank'
                  ? 'Found on your NetBanking transfer confirmation receipt or SMS.'
                  : 'Found in your UPI receipt (e.g., GooglePay UPI Transaction ID / PhonePe UTR).'}
              </p>
            </div>

            {/* Payer Details */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {paymentMethod === 'crypto'
                  ? '4. Sender Wallet Address / Exchange Name (Optional)'
                  : paymentMethod === 'bank'
                  ? '4. Sender Bank Name & Account Holder Name (Optional)'
                  : '4. Your Payer Name / UPI ID (Optional)'}
              </label>
              <input
                type="text"
                value={payerDetails}
                onChange={(e) => setPayerDetails(e.target.value)}
                placeholder={
                  paymentMethod === 'crypto'
                    ? 'e.g. Binance / TrustWallet'
                    : paymentMethod === 'bank'
                    ? 'e.g. HDFC Bank - Rahul Sharma'
                    : 'e.g. Rahul Sharma or rahul@okaxis'
                }
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || (paymentMethod === 'crypto' ? (!usdtAmount || !utrNumber) : (!amount || !utrNumber))}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Submit Deposit Verification</span>
                  <ShieldCheck className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Pending Deposit Requests Table */}
      {userDepositRequests.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Your Deposit Verification Requests</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">UTR / Ref No</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {userDepositRequests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-800/30">
                    <td className="py-3 text-slate-400">
                      {new Date(req.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 font-mono font-bold text-emerald-400">
                      {formatCurrency(req.amount)}
                    </td>
                    <td className="py-3 uppercase text-slate-300">{req.method}</td>
                    <td className="py-3 font-mono text-slate-300">{req.utr}</td>
                    <td className="py-3">
                      {req.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      ) : req.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-medium" title={req.rejectionReason}>
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-medium">
                          <Clock className="w-3 h-3" /> In Verification
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complete Wallet Transactions Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-indigo-400" />
          <span>Wallet Ledger & Transaction History</span>
        </h3>

        {userTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No transactions recorded yet in your wallet ledger.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Balance After</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {userTransactions.map(tx => {
                  const isCredit = tx.type === 'DEPOSIT_APPROVED' || tx.type === 'REFUND' || tx.amount > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                          isCredit ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isCredit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={isCredit ? 'text-emerald-400' : 'text-rose-400'}>
                          {isCredit ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {formatCurrency(tx.balanceAfter)}
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs">
                        {tx.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
