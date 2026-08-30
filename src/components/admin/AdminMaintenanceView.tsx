import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  Sliders, 
  History, 
  Eye, 
  Check, 
  RefreshCw, 
  Lock, 
  Terminal,
  Zap,
  Palette,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  User,
  ArrowRight,
  RotateCcw,
  Undo2,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSociarax } from '../../context/SociaraxContext';
import { getTheme, getButtonRadius } from '../../utils/theme';
import { WebsiteMaintenanceConfig } from '../../types';

interface SafetyCheck {
  code: string;
  name: string;
  status: 'PASS' | 'BLOCK' | 'WARN';
  detail: string;
}

interface MaintenanceLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  command: string;
  safetyScore: number;
  safetyStatus: 'SAFE' | 'BLOCKED' | 'WARNING';
  safetyChecks: SafetyCheck[];
  status: 'APPLIED' | 'REJECTED' | 'ROLLED_BACK';
  summary: string;
  appliedDiff: Partial<WebsiteMaintenanceConfig>;
  previousConfig: WebsiteMaintenanceConfig;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionType?: 'CUSTOMIZE' | 'DIAGNOSTIC' | 'CONVERSATION' | 'BLOCKED';
  appliedDiff?: Partial<WebsiteMaintenanceConfig>;
  safetyScore?: number;
  verified?: boolean;
}

export const AdminMaintenanceView: React.FC = () => {
  const { adminToken, userToken } = useAuth();
  const { maintenanceConfig, refreshMaintenanceConfig, updateMaintenanceConfigLocally, loadSettings } = useSociarax();
  const token = adminToken || userToken;
  
  const [config, setConfig] = useState<WebsiteMaintenanceConfig | null>(maintenanceConfig);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatBackup, setChatBackup] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('sociarax_chat_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'customizer' | 'logs' | 'security'>('chat');
  
  // Voice input state (Web Speech API)
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isVoiceResponseEnabled, setIsVoiceResponseEnabled] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const theme = getTheme(config || maintenanceConfig);
  const buttonRadius = getButtonRadius(config || maintenanceConfig);
  
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    safetyScore: number;
    safetyStatus: string;
    safetyChecks: SafetyCheck[];
    plan: string;
    appliedDiff: Partial<WebsiteMaintenanceConfig>;
    explanation: string;
    error?: string;
  } | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const quickPrompts = [
    { label: 'Referral ON Karo (Enable)', prompt: 'Referral system enable karo' },
    { label: 'Referral OFF Karo (Disable)', prompt: 'Referral system off kardo' },
    { label: 'Referral Bonus ₹50 karo', prompt: 'Referral bonus 50 rupaye kardo' },
    { label: 'Referral Live Status', prompt: 'Referral system ka live status batao' },
    { label: 'Replace TG/WA with SociaraX Label', prompt: 'Only change the top header: replace the Telegram/WhatsApp contact buttons with a simple “SociaraX” label. Do not change anything else.' },
    { label: 'Show TG & WA Contact Buttons', prompt: 'Show Telegram and WhatsApp support contact buttons in the top header' },
    { label: 'Emerald Green Theme', prompt: 'Website ka theme color Emerald Green kardo' },
    { label: 'Royal Purple Theme', prompt: 'Website ka color purple kardo aur modern styling do' },
    { label: 'Ocean Blue Theme', prompt: 'Change website theme color to Ocean Blue with blue accent gradient' },
    { label: 'Switch to Rounded Pill Buttons', prompt: 'Switch UI buttons style to rounded pill buttons' },
    { label: 'Login Modal Headline', prompt: 'Login page ka headline change karke "Welcome to SociaraX Pro" kardo' },
    { label: 'Website Status / Health Check', prompt: 'Website me koi problem ya error hai kya? Health status batao' }
  ];

  // Initialize Speech Recognition & Voice List
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = 'hi-IN,en-IN,en-US';

        recog.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setCommand(transcript);
          }
          setIsListening(false);
        };

        recog.onerror = (e: any) => {
          console.warn('Speech recognition error:', e);
          setIsListening(false);
        };

        recog.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recog;
      }

      // Populate Web Speech Synthesis voices
      if (window.speechSynthesis) {
        const updateVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          setAvailableVoices(voices);
        };
        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or text input.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  };

  const getBestIndianVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    if (selectedVoiceName) {
      const found = voices.find(v => v.name === selectedVoiceName);
      if (found) return found;
    }

    // 1. Direct Hindi voice (hi-IN, Google हिन्दी, Swara, Madhur, Kalpana, Lekha)
    const hindiVoice = voices.find(v => 
      v.lang === 'hi-IN' || 
      v.lang === 'hi_IN' || 
      v.lang.toLowerCase().startsWith('hi') ||
      v.name.toLowerCase().includes('hindi') || 
      v.name.includes('हिन्दी')
    );
    if (hindiVoice) return hindiVoice;

    // 2. Indian English voice (en-IN, India, Neerja, Ravi, Heera, Swara, Madhur, Veena)
    const indianEnglishVoice = voices.find(v => 
      v.lang === 'en-IN' || 
      v.lang === 'en_IN' || 
      v.name.toLowerCase().includes('india') ||
      v.name.toLowerCase().includes('neerja') ||
      v.name.toLowerCase().includes('ravi') ||
      v.name.toLowerCase().includes('heera') ||
      v.name.toLowerCase().includes('veena')
    );
    if (indianEnglishVoice) return indianEnglishVoice;

    return voices[0] || null;
  };

  const speakText = (text: string) => {
    if (!isVoiceResponseEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      
      // Clean text for natural speech (remove markdown symbols, emojis, URLs, bullets)
      const cleanText = text
        .replace(/[*_#`~>]/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
        .replace(/^[•\-\d+\.]\s+/gm, '')
        .replace(/\bhttps?:\/\/\S+/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voice = getBestIndianVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'hi-IN';
      } else {
        utterance.lang = 'hi-IN';
      }

      utterance.rate = 0.95; // Natural pace for Hindi & Hinglish articulation
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/maintenance/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to load maintenance config:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/maintenance/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load maintenance logs:', err);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch('/api/admin/maintenance/chat/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setMessages(data.history);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchLogs();
    fetchChatHistory();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleExecute = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = customPrompt || command;
    if (!promptToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: promptToSend.trim(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setCommand('');
    setIsLoading(true);
    setNotification(null);

    try {
      const res = await fetch('/api/admin/maintenance/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command: promptToSend.trim() })
      });
      const data = await res.json();
      setLastResult(data);

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: data.explanation || (data.success ? 'Aapka task complete ho gaya hai!' : (data.error || 'Request reject hui.')),
        timestamp: new Date().toISOString(),
        actionType: data.actionType || (data.success ? 'CUSTOMIZE' : 'BLOCKED'),
        appliedDiff: data.appliedDiff,
        safetyScore: data.safetyScore,
        verified: data.success
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.success) {
        if (data.currentConfig) {
          setConfig(data.currentConfig);
          updateMaintenanceConfigLocally(data.currentConfig);
        }
        await refreshMaintenanceConfig();
        await loadSettings();
        fetchLogs();
        speakText(assistantMsg.text);
      } else {
        setNotification({ type: 'error', message: data.error || data.explanation || 'Operation rejected by security policy.' });
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: 'Server connection me temporary issue aaya. Please dobara try karein.',
        timestamp: new Date().toISOString(),
        actionType: 'BLOCKED'
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChatClick = () => {
    if (messages.length === 0) return;
    setShowClearConfirmModal(true);
  };

  const handleConfirmClearChat = async () => {
    setShowClearConfirmModal(false);
    if (messages.length > 0) {
      setChatBackup(messages);
      try {
        localStorage.setItem('sociarax_chat_backup', JSON.stringify(messages));
      } catch (e) {
        console.warn('Chat backup save error:', e);
      }
    }

    try {
      const res = await fetch('/api/admin/maintenance/chat/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setMessages([]);
        setNotification({ type: 'success', message: 'Chat history cleared. You can restore your conversation anytime!' });
      }
    } catch (err) {
      setMessages([]);
    }
  };

  const handleRestoreChat = () => {
    if (chatBackup && chatBackup.length > 0) {
      setMessages(chatBackup);
      setNotification({ type: 'success', message: 'Chat history restored successfully!' });
    }
  };

  const handlePreview = async () => {
    if (!command.trim()) return;

    setIsPreviewLoading(true);
    setNotification(null);
    try {
      const res = await fetch('/api/admin/maintenance/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command: command.trim() })
      });
      const data = await res.json();
      setLastResult(data);
      if (!data.success) {
        setNotification({ type: 'error', message: data.error || 'Security risk identified.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Preview request failed.' });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleRollback = async (logId: string) => {
    if (!confirm('Are you sure you want to rollback this maintenance change?')) return;

    try {
      const res = await fetch('/api/admin/maintenance/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ logId })
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: data.message });
        if (data.config) {
          setConfig(data.config);
          updateMaintenanceConfigLocally(data.config);
        }
        refreshMaintenanceConfig();
        fetchLogs();
        fetchChatHistory();
      } else {
        setNotification({ type: 'error', message: data.error || 'Rollback failed.' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Rollback connection failed.' });
    }
  };

  const handleDirectUpdate = async (partial: Partial<WebsiteMaintenanceConfig>) => {
    try {
      const res = await fetch('/api/admin/maintenance/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ config: partial })
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        updateMaintenanceConfigLocally(data.config);
        refreshMaintenanceConfig();
        setNotification({ type: 'success', message: 'Setting updated immediately.' });
        fetchLogs();
        fetchChatHistory();
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Direct update failed.' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Bot className="w-3.5 h-3.5" />
              <span>Autonomous AI Assistant & Website Controller</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              AI Website Control & Conversational Assistant
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Talk directly to your AI Assistant via voice or chat to customize website theme, header, login headlines, or query database health with zero downtime and instant rollback.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => { fetchConfig(); fetchLogs(); fetchChatHistory(); }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh State"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Multi-Layer Safety Active</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Conversational Chat & Voice</span>
          </button>

          <button
            onClick={() => setActiveTab('customizer')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'customizer'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Quick Customizer</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History & Rollback ({logs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Security & Isolation Rules</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CONVERSATIONAL AI CHAT & VOICE INTERFACE */}
      {/* ========================================================================= */}
      {activeTab === 'chat' && (
        <div className="space-y-6">
          {/* Chat Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col h-[600px]">
            {/* Chat Top Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">SociaraX AI Assistant</h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <p className="text-[11px] text-slate-400">Talk in Hindi, Hinglish, or English</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {chatBackup && chatBackup.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreChat}
                    className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/50 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Restore Previous Conversation (Deleted Chat Wapas Layein)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Restore Chat</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsVoiceResponseEnabled(!isVoiceResponseEnabled)}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isVoiceResponseEnabled 
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' 
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                  title={isVoiceResponseEnabled ? 'Voice Responses Enabled' : 'Voice Responses Muted'}
                >
                  {isVoiceResponseEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                  <span className="hidden sm:inline">{isVoiceResponseEnabled ? 'Hindi Voice ON' : 'Voice Muted'}</span>
                </button>

                {isVoiceResponseEnabled && (
                  <button
                    type="button"
                    onClick={() => speakText('Namaste! Main SociaraX ka AI Assistant hoon. Main aapki website ko live customize aur manage karne ke liye taiyaar hoon.')}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-900 text-indigo-400 hover:text-indigo-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Test Indian Hindi Voice Output"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Test Voice</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleClearChatClick}
                  disabled={messages.length === 0}
                  className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-rose-950/30 hover:border-rose-800/40 text-slate-400 hover:text-rose-400 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Clear Chat (With Instant Undo Protection)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
                  <Bot className="w-12 h-12 text-slate-700 animate-pulse" />
                  <p className="text-xs max-w-sm">
                    Namaste! Main SociaraX ka Conversational AI Assistant hoon. Aap bolkar ya likhkar website ke header, colors, buttons, referral system ya login headlines customize kar sakte hain.
                  </p>
                  {chatBackup && chatBackup.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleRestoreChat}
                        className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
                      >
                        <RotateCcw className="w-4 h-4 text-indigo-400" />
                        <span>Purani Chat Wapas Layein ({chatBackup.length} messages)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 border border-slate-700 text-indigo-300'
                      }`}
                    >
                      {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none space-y-2'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {/* If AI applied parameter changes, render badge and diff */}
                      {msg.appliedDiff && Object.keys(msg.appliedDiff).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Applied & Verified in Live Portal</span>
                          </div>
                          <pre className="p-2 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                            {JSON.stringify(msg.appliedDiff, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.safetyScore !== undefined && (
                          <span className="text-emerald-400/80">Safety: {msg.safetyScore}/100</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-300 shrink-0">
                    <Bot className="w-4 h-4 animate-spin text-indigo-400" />
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs text-indigo-300 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    <span>Analyzing instruction & applying safety verification...</span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="py-2 overflow-x-auto flex gap-1.5 shrink-0 border-t border-slate-800">
              {quickPrompts.slice(0, 4).map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleExecute(undefined, qp.prompt)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Message Input Box */}
            <form onSubmit={(e) => handleExecute(e)} className="pt-2 flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder={isListening ? 'Listening to your voice...' : 'Type or speak your customization prompt (e.g. Website ka color emerald green kardo)...'}
                  className={`w-full bg-slate-950 border rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-all ${
                    isListening ? 'border-rose-500 ring-2 ring-rose-500/30 animate-pulse' : 'border-slate-800'
                  }`}
                />
              </div>

              {/* Voice Input Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-2xl border font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/40 animate-pulse'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                }`}
                title={isListening ? 'Stop listening' : 'Start speaking (Voice Input)'}
              >
                {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-indigo-400" />}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || !command.trim()}
                className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>

          {/* Current Live UI Parameters Overview */}
          {config && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-white">Live Website Customization State</h4>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Active on Portal
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Theme Accent Color</div>
                  <div className="text-white font-bold capitalize mt-0.5 flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-full ${
                      config.themeColor === 'emerald' ? 'bg-emerald-500' :
                      config.themeColor === 'blue' ? 'bg-blue-500' :
                      config.themeColor === 'purple' ? 'bg-purple-500' :
                      config.themeColor === 'rose' ? 'bg-rose-500' :
                      config.themeColor === 'amber' ? 'bg-amber-500' :
                      config.themeColor === 'cyan' ? 'bg-cyan-500' : 'bg-indigo-500'
                    }`} />
                    {config.themeColor}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Top Header Layout</div>
                  <div className="text-white font-bold mt-0.5">
                    {config.showHeaderSimpleLabelOnly ? `Simple "${config.headerSimpleLabel}" Label` : 'Contact Buttons (TG & WA)'}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Button Style</div>
                  <div className="text-white font-bold mt-0.5">{config.buttonStyle}</div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Announcement Banner</div>
                  <div className="text-white font-bold mt-0.5">
                    {config.announcementBannerActive ? (
                      <span className="text-emerald-400">Enabled</span>
                    ) : (
                      <span className="text-slate-500">Disabled</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUICK CUSTOMIZER (MANUAL CONTROLS) */}
      {/* ========================================================================= */}
      {activeTab === 'customizer' && config && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">Manual Quick Customizer</h3>
              <p className="text-xs text-slate-400">Directly fine-tune visual theme parameters and UI styles.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Color Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Primary Theme Accent
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                  { id: 'blue', label: 'Blue', bg: 'bg-blue-600' },
                  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
                  { id: 'purple', label: 'Purple', bg: 'bg-purple-600' },
                  { id: 'rose', label: 'Rose', bg: 'bg-rose-600' },
                  { id: 'amber', label: 'Amber', bg: 'bg-amber-600' },
                  { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-600' },
                  { id: 'violet', label: 'Violet', bg: 'bg-violet-600' }
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleDirectUpdate({ themeColor: c.id as any })}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      config.themeColor === c.id
                        ? 'border-indigo-500 bg-indigo-500/20 text-white font-bold'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${c.bg}`} />
                    <span className="text-[11px]">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Header Layout & Button Style */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Top Header Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDirectUpdate({ showHeaderSimpleLabelOnly: true, headerSimpleLabel: 'SociaraX' })}
                    className={`p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                      config.showHeaderSimpleLabelOnly
                        ? 'border-indigo-500 bg-indigo-500/20 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>Simple "SociaraX" Label Only</div>
                    <div className="text-[10px] text-slate-500 mt-1">Replaces TG & WA buttons with clean branding</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDirectUpdate({ showHeaderSimpleLabelOnly: false, showSupportInHeader: true })}
                    className={`p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                      !config.showHeaderSimpleLabelOnly
                        ? 'border-indigo-500 bg-indigo-500/20 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div>Telegram & WhatsApp Buttons</div>
                    <div className="text-[10px] text-slate-500 mt-1">Direct support links in header</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Button Corner Radius
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'rounded-xl', label: 'Modern (12px)' },
                    { id: 'rounded-2xl', label: 'Ultra Smooth (16px)' },
                    { id: 'rounded-lg', label: 'Sharp (8px)' },
                    { id: 'rounded-full', label: 'Pill (Full Round)' }
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleDirectUpdate({ buttonStyle: b.id as any })}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        config.buttonStyle === b.id
                          ? 'border-indigo-500 bg-indigo-500/20 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AUDIT HISTORY & INSTANT ROLLBACK */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">Maintenance Audit Trail & Rollback</h3>
              <p className="text-xs text-slate-400">Complete immutable record of all AI and manual website customizations.</p>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs bg-slate-950 rounded-2xl border border-slate-800">
              No maintenance actions recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((lg) => (
                <div
                  key={lg.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        lg.status === 'APPLIED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                        lg.status === 'ROLLED_BACK' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {lg.status}
                      </span>
                      <span className="text-xs font-bold text-white font-mono">{lg.command}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{lg.summary}</div>
                    <div className="text-[10px] text-slate-500">
                      Executed by {lg.adminEmail} on {new Date(lg.timestamp).toLocaleString()}
                    </div>
                  </div>

                  {lg.status === 'APPLIED' && (
                    <button
                      onClick={() => handleRollback(lg.id)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 self-start md:self-auto"
                    >
                      <span>Rollback</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SECURITY & ISOLATION RULES */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">6-Layer Security & Isolation Rules</h3>
              <p className="text-xs text-slate-400">Strict sandboxing protecting your credentials and database integrity.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Zero Database Destruction (SQL Injection Shield)</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Commands attempting SQL queries, DROP tables, TRUNCATE, or data deletions are automatically blocked by deterministic filters before reaching the execution layer.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Credential Redaction & Secret Isolation</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Requests asking to print or extract JWT secret keys, Neon PostgreSQL URLs, or provider API keys are unconditionally neutralized.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Whitelist Parameter Schema Validation</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Only strictly defined visual theme and UI layout keys (colors, button radii, banners, headlines) can be mutated.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Deterministic Fallback Resilience</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                If Gemini API models experience temporary demand surges (503 / 429), deterministic natural language rule trees execute seamless website customization without downtime.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal with Undo Safety */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
                <Trash2 className="w-5 h-5" />
                <span>AI Chat History Delete Karein?</span>
              </div>
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Kya aap AI Assistant ki current conversation history delete karna chahte hain?
              </p>
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-[11px] flex items-center gap-2">
                <RotateCcw className="w-4 h-4 shrink-0 text-indigo-400" />
                <span>
                  <strong>Suraksha Feature:</strong> Galti se delete ho jane par bhi aap kabhi bhi <strong>"Restore Chat"</strong> button se sari history wapas la sakte hain!
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel (Rakhna Hai)
              </button>
              <button
                type="button"
                onClick={handleConfirmClearChat}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
              >
                Yes, Delete Karein
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
