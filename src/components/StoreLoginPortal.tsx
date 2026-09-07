import React, { useState } from 'react';
import { Store, User, Lock, ArrowRight, ShieldCheck, Sparkles, Building2, Coffee, Key, Phone, MapPin } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface StoreLoginPortalProps {
  tenants: any[];
  onLogin: (tenant: any, token?: string) => void;
  onRegister: (newTenant: any) => void;
}

export default function StoreLoginPortal({ tenants = [], onLogin, onRegister }: StoreLoginPortalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'pin' | 'google'>('google');
  
  // Registration form
  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [cashierPin, setCashierPin] = useState('');
  
  // Login form
  const [loginPin, setLoginPin] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleGoogleAuth = async (action: 'login' | 'register') => {
    setErrorMsg('');
    setIsAuthorizing(true);
    
    if (action === 'register') {
      if (!storeName || !storePhone || !cashierPin) {
        setErrorMsg('Harap lengkapi Nama Toko, No Telp, dan PIN Kasir awal.');
        setIsAuthorizing(false);
        return;
      }
      if (cashierPin.length < 4) {
        setErrorMsg('PIN Kasir minimal 4 digit.');
        setIsAuthorizing(false);
        return;
      }
    }

    if (action === 'login' && loginMethod === 'pin' && !loginPin) {
      setErrorMsg('Harap masukkan PIN Kasir.');
      setIsAuthorizing(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const payload: any = { idToken, action };
      
      if (action === 'register') {
        payload.storeName = storeName;
        payload.storePhone = storePhone;
        payload.storeAddress = storeAddress;
        payload.cashierName = cashierName || 'Kasir 1';
        payload.pin = cashierPin;
      } else {
        payload.role = loginMethod === 'pin' ? 'Cashier' : 'Owner';
        if (payload.role === 'Cashier') {
          payload.pin = loginPin;
        }
      }

      const response = await fetch('/api/auth/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        if (action === 'register') {
          onRegister(data.tenant);
          // Optional: directly login after register
          onLogin(data.tenant, data.token);
        } else {
          onLogin(data.tenant, data.token);
        }
      } else {
        setErrorMsg(data.message || 'Gagal autentikasi.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain') {
        setErrorMsg('Domain ini belum diizinkan di Firebase. Tambahkan ' + window.location.hostname + ' ke Authorized Domains di Firebase Console (Authentication > Settings > Authorized domains).');
        return;
      }
      setErrorMsg(err.message || 'Kesalahan saat terhubung ke Google.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Branding */}
        <div className="md:w-5/12 bg-slate-900 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/20 blur-3xl rounded-full -translate-x-1/3 translate-y-1/3" />
          
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-8">
              <Coffee className="text-amber-400 w-7 h-7" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 leading-tight">
              LedgerLine <br/><span className="text-amber-400">POS Modern</span>
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed mb-8">
              Platform kasir pintar dengan teknologi enkripsi canggih dan integrasi Google Workspace. Kelola toko Anda dengan aman dan mudah tanpa ribet OTP.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <ShieldCheck className="text-emerald-400 w-5 h-5" /> Keamanan Google OAuth 2.0
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <Sparkles className="text-indigo-400 w-5 h-5" /> AI Studio Powered
              </div>
            </div>
          </div>
          
          <div className="relative z-10 mt-12 pt-8 border-t border-white/10">
            <p className="text-xs text-slate-400 font-mono">
              &copy; 2026 Ledger Line by Aslam. All rights reserved.
            </p>
          </div>
        </div>

        {/* Right Side - Forms */}
        <div className="md:w-7/12 p-8 sm:p-12 relative">
          
          <div className="flex bg-slate-100 rounded-xl p-1 mb-8 max-w-sm mx-auto">
            <button 
              onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Masuk Toko
            </button>
            <button 
              onClick={() => { setActiveTab('register'); setErrorMsg(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Daftar Baru
            </button>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl font-medium flex items-start gap-3 animate-fade-in">
              <span className="shrink-0 mt-0.5">⚠️</span>
              {errorMsg}
            </div>
          )}

          {activeTab === 'login' && (
            <div className="space-y-6 animate-fade-in max-w-md mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-extrabold text-slate-900">Selamat Datang</h2>
                <p className="text-slate-500 text-sm mt-2">Silakan masuk untuk mengelola toko Anda</p>
              </div>

              <div className="flex gap-4 mb-6">
                <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all flex flex-col items-center gap-2 ${loginMethod === 'google' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <input type="radio" className="hidden" checked={loginMethod === 'google'} onChange={() => setLoginMethod('google')} />
                  <User size={24} />
                  <span className="text-xs font-bold uppercase tracking-wide">Owner</span>
                </label>
                <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all flex flex-col items-center gap-2 ${loginMethod === 'pin' ? 'border-amber-500 bg-amber-50/50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  <input type="radio" className="hidden" checked={loginMethod === 'pin'} onChange={() => setLoginMethod('pin')} />
                  <Lock size={24} />
                  <span className="text-xs font-bold uppercase tracking-wide">Kasir</span>
                </label>
              </div>

              {loginMethod === 'pin' && (
                <div className="space-y-4 mb-6 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">PIN Kasir *</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-3.5 text-slate-400" size={18} />
                      <input 
                        type="password" 
                        maxLength={6}
                        placeholder="Masukkan PIN Kasir"
                        value={loginPin}
                        onChange={e => setLoginPin(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none transition-all font-mono font-bold tracking-widest text-lg"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 text-center">Anda tetap harus memverifikasi identitas dengan Akun Google toko Anda.</p>
                </div>
              )}

              <button
                onClick={() => handleGoogleAuth('login')}
                disabled={isAuthorizing}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {isAuthorizing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Lanjutkan dengan Google
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'register' && (
            <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900">Daftar Toko Baru</h2>
                <p className="text-slate-500 text-sm mt-1">Satu akun Google untuk semua akses kedai Anda</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Toko *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input type="text" placeholder="Kopi Senja" value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-amber-500 focus:bg-white outline-none transition-all"/>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">No WhatsApp Toko *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input type="text" placeholder="08123456789" value={storePhone} onChange={e => setStorePhone(e.target.value.replace(/\D/g, ''))} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-amber-500 focus:bg-white outline-none transition-all"/>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Alamat Lengkap</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input type="text" placeholder="Jl. Raya No. 1" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-amber-500 focus:bg-white outline-none transition-all"/>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Kasir Utama</label>
                  <input type="text" placeholder="Barista 1" value={cashierName} onChange={e => setCashierName(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-amber-500 focus:bg-white outline-none transition-all"/>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PIN Kasir (Min 4) *</label>
                  <input type="password" placeholder="1234" maxLength={6} value={cashierPin} onChange={e => setCashierPin(e.target.value.replace(/\D/g, ''))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono tracking-widest focus:border-amber-500 focus:bg-white outline-none transition-all"/>
                </div>
              </div>

              <button
                onClick={() => handleGoogleAuth('register')}
                disabled={isAuthorizing}
                className="w-full mt-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {isAuthorizing ? (
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Daftar dengan Akun Google
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
