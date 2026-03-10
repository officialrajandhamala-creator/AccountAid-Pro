
import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Lock, Mail, ArrowRight, User, ShieldAlert, Smartphone, LogIn, RefreshCw, Trash2, Plus, Pause, Play, Key, Eye, EyeOff } from 'lucide-react';
import { AppState, SuperAdminSession } from '../types';

interface LoginProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  gatewayUser: any;
  onGatewayLogin: (user: any) => void;
  onRoleLogin: (user: { id: string, name: string, role: 'admin' | 'user' }) => void;
  isMainDevice: boolean;
  superAdminSession: SuperAdminSession | null;
  onSuperAdminLogin: (session: SuperAdminSession) => void;
  onSuperAdminLogout: (force?: boolean) => void;
}

const GLOBAL_USERS_KEY = 'accountaid_global_user_directory_pro';
const SUPERADMIN_ID = 'AccountAid@domain.com.np';
const SUPERADMIN_PASS = 'AccountAid@2026';

const Login: React.FC<LoginProps> = ({ 
  state, setState, gatewayUser, onGatewayLogin, onRoleLogin, isMainDevice,
  superAdminSession, onSuperAdminLogin, onSuperAdminLogout
}) => {
  const [view, setView] = useState<'gateway' | 'role' | 'admin-setup' | 'user-login' | 'admin-login' | 'superadmin-login' | 'superadmin-dashboard'>(
    gatewayUser ? 'role' : 'gateway'
  );
  
  const [gatewayAction, setGatewayAction] = useState<'signin' | 'signup' | 'team' | null>(null);
  const [formData, setFormData] = useState({ 
    email: '', password: '', adminPass: '', userUser: '', userPass: '',
    teamId: '', teamPass: '', impersonateEmail: '',
    newWorkspaceEmail: '', newWorkspacePass: '',
    newWorkspaceCompanyName: '', newWorkspaceCompanyPan: '', newWorkspaceCompanyAddress: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  const [credentialManageEmail, setCredentialManageEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (gatewayUser && view === 'gateway') {
      setView('role');
    }
  }, [gatewayUser, view]);

  useEffect(() => {
    if (!superAdminSession && view === 'superadmin-dashboard') {
      setView('gateway');
      setGatewayAction(null);
    }
  }, [superAdminSession, view]);

  const handleGatewaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (gatewayAction === 'team') {
      setTimeout(() => {
        setIsLoading(false);
        if (formData.teamId === SUPERADMIN_ID && formData.teamPass === SUPERADMIN_PASS) {
          onSuperAdminLogin({ teamId: formData.teamId, isSuperAdmin: true });
          setView('superadmin-dashboard');
        } else {
          setError('Invalid Team Credentials.');
        }
      }, 800);
      return;
    }

    const users = JSON.parse(localStorage.getItem(GLOBAL_USERS_KEY) || '{}');
    const email = formData.email.toLowerCase().trim();

    setTimeout(() => {
      setIsLoading(false);
      if (gatewayAction === 'signin') {
        if (!users[email] || users[email].password !== formData.password) {
          return setError('Invalid workspace credentials. Please check your email and passphrase.');
        }
        if (users[email].isPaused) {
          return setError('This workspace has been paused by the Super Admin.');
        }
        onGatewayLogin({ email });
      } else {
        if (users[email]) return setError('This workspace already exists. Please sign in instead.');
        users[email] = { password: formData.password, isVerified: true };
        localStorage.setItem(GLOBAL_USERS_KEY, JSON.stringify(users));
        // Initialize state for new workspace
        localStorage.setItem(`accountaid_state_pro_${email}`, JSON.stringify({
          inventory: [],
          parties: [
            { id: 'treasury-cash', name: 'Cash A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
            { id: 'treasury-bank', name: 'Bank A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
            { id: 'treasury-wallet', name: 'Wallet A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
          ],
          transactions: [],
          repairs: [],
          journals: [],
          locations: [{ id: 'default', name: 'Main Store' }],
          managedUsers: [],
          mainDeviceId: null,
          adminPassword: null,
          lastBackupDate: null,
          hasUnsavedChanges: false,
          cashVault: { 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 },
          settings: {
            dateSystem: 'AD',
            currency: 'Rs.',
            securityPin: '',
            securityPinSet: false,
            lastPinChangeDate: new Date().toISOString().split('T')[0],
            vatEnabled: false,
            vatRate: 13,
          },
        }));
        onGatewayLogin({ email });
      }
    }, 800);
  };

  const handleAdminSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.adminPass.length < 4) return setError('PIN must be at least 4 digits.');
    setState(prev => ({ ...prev, adminPassword: formData.adminPass, mainDeviceId: 'PRIMARY_CONSOLE' }));
    onRoleLogin({ id: 'admin', name: 'Administrator', role: 'admin' });
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (superAdminSession || formData.adminPass === state.adminPassword) {
      onRoleLogin({ id: 'admin', name: 'Administrator', role: 'admin' });
    } else {
      setError('Invalid Master PIN.');
      setFormData({ ...formData, adminPass: '' });
    }
  };

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = state.managedUsers.find(u => u.username === formData.userUser && u.password === formData.userPass);
    
    if (user && user.isPaused && !superAdminSession) {
      setError('Your account has been paused. Please contact the administrator.');
      return;
    }

    if (superAdminSession || user) {
      onRoleLogin({ 
        id: user?.id || 'sa-operator', 
        name: user?.name || 'SuperAdmin Operator', 
        role: (user?.role as 'admin' | 'user') || 'user' 
      });
    } else {
      setError('Invalid Operator Credentials.');
    }
  };

  const handleImpersonate = (e: React.FormEvent) => {
    e.preventDefault();
    const email = formData.impersonateEmail.toLowerCase().trim();
    const users = JSON.parse(localStorage.getItem(GLOBAL_USERS_KEY) || '{}');
    
    if (!users[email]) {
      setError('User workspace not found in registry.');
      return;
    }
    
    onGatewayLogin({ email });
    setView('role');
  };

  const handleDeleteWorkspace = (email: string) => {
    if (!confirm(`CRITICAL: Are you sure you want to PERMANENTLY delete the workspace [${email}]? All data will be lost.`)) return;
    const users = JSON.parse(localStorage.getItem(GLOBAL_USERS_KEY) || '{}');
    delete users[email];
    localStorage.setItem(GLOBAL_USERS_KEY, JSON.stringify(users));
    // Also clear the state for that user
    localStorage.removeItem(`accountaid_state_pro_${email}`);
    setRefreshCounter(prev => prev + 1);
  };

  const handleTogglePauseWorkspace = (email: string) => {
    const users = JSON.parse(localStorage.getItem(GLOBAL_USERS_KEY) || '{}');
    if (users[email]) {
      users[email].isPaused = !users[email].isPaused;
      localStorage.setItem(GLOBAL_USERS_KEY, JSON.stringify(users));
      setRefreshCounter(prev => prev + 1);
    }
  };

  const handleChangePassword = (email: string) => {
    if (!newPassword) return;
    const users = JSON.parse(localStorage.getItem(GLOBAL_USERS_KEY) || '{}');
    if (users[email]) {
      users[email].password = newPassword;
      localStorage.setItem(GLOBAL_USERS_KEY, JSON.stringify(users));
      setCredentialManageEmail(null);
      setNewPassword('');
      alert(`Password for ${email} updated successfully.`);
      setRefreshCounter(prev => prev + 1);
    }
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    const email = formData.newWorkspaceEmail.toLowerCase().trim();
    const pass = formData.newWorkspacePass;
    const users = JSON.parse(localStorage.getItem(GLOBAL_USERS_KEY) || '{}');
    
    if (users[email]) {
      setError('Workspace already exists.');
      return;
    }
    
    users[email] = { 
      password: pass, 
      isVerified: true,
      companyName: formData.newWorkspaceCompanyName,
      companyPan: formData.newWorkspaceCompanyPan,
      companyAddress: formData.newWorkspaceCompanyAddress
    };
    localStorage.setItem(GLOBAL_USERS_KEY, JSON.stringify(users));
    
    // Initialize state for new workspace with company details
    localStorage.setItem(`accountaid_state_pro_${email}`, JSON.stringify({
      inventory: [],
      parties: [
        { id: 'treasury-cash', name: 'Cash A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
        { id: 'treasury-bank', name: 'Bank A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
        { id: 'treasury-wallet', name: 'Wallet A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
      ],
      transactions: [],
      repairs: [],
      journals: [],
      locations: [{ id: 'default', name: 'Main Store' }],
      managedUsers: [],
      mainDeviceId: null,
      adminPassword: null,
      lastBackupDate: null,
      hasUnsavedChanges: false,
      cashVault: { 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 },
      settings: {
        dateSystem: 'AD',
        currency: 'Rs.',
        securityPin: '',
        securityPinSet: false,
        lastPinChangeDate: new Date().toISOString().split('T')[0],
        vatEnabled: false,
        vatRate: 13,
        companyName: formData.newWorkspaceCompanyName,
        companyPan: formData.newWorkspaceCompanyPan,
        companyAddress: formData.newWorkspaceCompanyAddress,
      },
    }));

    setFormData({ 
      ...formData, 
      newWorkspaceEmail: '', 
      newWorkspacePass: '',
      newWorkspaceCompanyName: '',
      newWorkspaceCompanyPan: '',
      newWorkspaceCompanyAddress: ''
    });
    setError('');
    setRefreshCounter(prev => prev + 1);
    alert(`Workspace [${email}] created successfully.`);
  };

  if (view === 'superadmin-dashboard') {
    const users = JSON.parse(localStorage.getItem(GLOBAL_USERS_KEY) || '{}');
    const userEmails = Object.keys(users);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 relative">
        <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-700">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-red-600 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl shadow-red-500/30 mb-8">
              <ShieldAlert className="text-white" size={40} />
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tighter uppercase">TEAM CONSOLE</h1>
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.4em]">SuperAdmin Privileged Access</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[3.5rem] p-10 shadow-2xl space-y-8 relative">
            <button 
              onClick={() => {
                onSuperAdminLogout();
              }} 
              className="absolute -top-12 left-6 flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all"
            >
              <ArrowRight size={16} className="rotate-180" /> Back to Gateway
            </button>
            <div className="flex justify-between items-center border-b border-slate-800 pb-6">
              <div>
                <p className="text-xs font-black text-white uppercase tracking-widest">Active: {superAdminSession?.teamId}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Registry: {userEmails.length} Workspaces Found</p>
              </div>
              <button onClick={onSuperAdminLogout} className="px-6 py-2 bg-red-600/10 text-red-400 border border-red-900/50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">Terminate</button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center ml-2">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Registered Workspaces</h3>
                <button 
                  onClick={() => setGatewayAction(gatewayAction === 'signup' ? 'team' : 'signup')} 
                  className="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:underline"
                >
                  {gatewayAction === 'signup' ? 'View List' : '+ Register New'}
                </button>
              </div>

              {gatewayAction === 'signup' ? (
                <form onSubmit={handleCreateWorkspace} className="p-8 bg-slate-950 border border-slate-800 rounded-3xl space-y-4 animate-in slide-in-from-top duration-300">
                  <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Initialize New Workspace</p>
                  <div className="grid grid-cols-1 gap-3">
                    <input 
                      type="email" 
                      required 
                      className="bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-2xl outline-none font-bold text-xs focus:border-blue-600 transition-all" 
                      placeholder="Client Email" 
                      value={formData.newWorkspaceEmail} 
                      onChange={e => setFormData({...formData, newWorkspaceEmail: e.target.value})} 
                    />
                    <input 
                      type="password" 
                      required 
                      className="bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-2xl outline-none font-bold text-xs focus:border-blue-600 transition-all" 
                      placeholder="Initial Passphrase" 
                      value={formData.newWorkspacePass} 
                      onChange={e => setFormData({...formData, newWorkspacePass: e.target.value})} 
                    />
                    <input 
                      type="text" 
                      className="bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-2xl outline-none font-bold text-xs focus:border-blue-600 transition-all" 
                      placeholder="Company Name (Optional)" 
                      value={formData.newWorkspaceCompanyName || ''} 
                      onChange={e => setFormData({...formData, newWorkspaceCompanyName: e.target.value})} 
                    />
                    <input 
                      type="text" 
                      className="bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-2xl outline-none font-bold text-xs focus:border-blue-600 transition-all" 
                      placeholder="Company PAN/VAT (Optional)" 
                      value={formData.newWorkspaceCompanyPan || ''} 
                      onChange={e => setFormData({...formData, newWorkspaceCompanyPan: e.target.value})} 
                    />
                    <input 
                      type="text" 
                      className="bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-2xl outline-none font-bold text-xs focus:border-blue-600 transition-all" 
                      placeholder="Company Address (Optional)" 
                      value={formData.newWorkspaceCompanyAddress || ''} 
                      onChange={e => setFormData({...formData, newWorkspaceCompanyAddress: e.target.value})} 
                    />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl transition-all">
                    Provision Workspace
                  </button>
                </form>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {userEmails.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-800 rounded-3xl">
                      <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">No workspaces registered in this node.</p>
                    </div>
                  ) : (
                    userEmails.map(email => {
                      const user = users[email];
                      return (
                        <div key={email} className="flex flex-col p-5 bg-slate-950 border border-slate-800 rounded-3xl hover:border-red-900/50 transition-all group gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-600 group-hover:text-red-500 transition-colors">
                                <Mail size={18} />
                              </div>
                              <div>
                                <p className="text-xs font-black text-white uppercase tracking-tight">{email}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                                  {user.isPaused ? 'Paused Workspace' : 'Verified Workspace'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  if (credentialManageEmail === email) {
                                    setCredentialManageEmail(null);
                                  } else {
                                    setCredentialManageEmail(email);
                                    setNewPassword('');
                                    setShowPassword(false);
                                  }
                                }}
                                className={`p-3 border rounded-2xl transition-all ${credentialManageEmail === email ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-900 text-slate-600 border-slate-800 hover:text-blue-500 hover:border-blue-900/50'}`}
                                title="Manage Credentials"
                              >
                                <Key size={16} />
                              </button>
                              <button 
                                onClick={() => handleTogglePauseWorkspace(email)}
                                className="p-3 bg-slate-900 text-slate-600 border border-slate-800 rounded-2xl hover:text-amber-500 hover:border-amber-900/50 transition-all"
                                title={user.isPaused ? "Resume Workspace" : "Pause Workspace"}
                              >
                                {user.isPaused ? <Play size={16} /> : <Pause size={16} />}
                              </button>
                              <button 
                                onClick={() => {
                                  onGatewayLogin({ email });
                                  setView('role');
                                }}
                                className="px-4 py-3 bg-slate-900 text-white border border-slate-800 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:border-red-600 transition-all flex items-center gap-2"
                              >
                                Access
                              </button>
                              <button 
                                onClick={() => handleDeleteWorkspace(email)}
                                className="p-3 bg-slate-900 text-slate-600 border border-slate-800 rounded-2xl hover:text-red-500 hover:border-red-900/50 transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          
                          {credentialManageEmail === email && (
                            <div className="pt-4 border-t border-slate-800/50 animate-in slide-in-from-top-2 duration-200">
                              <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800">
                                  <div className="flex items-center gap-3">
                                    <Lock size={14} className="text-slate-500" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Password:</span>
                                    <span className="text-xs font-mono text-white tracking-wider">
                                      {showPassword ? user.password : '••••••••'}
                                    </span>
                                  </div>
                                  <button onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-white transition-colors">
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                                
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    className="flex-1 bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-2xl outline-none font-bold text-xs focus:border-blue-600 transition-all" 
                                    placeholder="New Password" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)} 
                                  />
                                  <button 
                                    onClick={() => handleChangePassword(email)}
                                    disabled={!newPassword}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                                  >
                                    Update
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-800">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 ml-2">Manual Access Bypass</p>
              <form onSubmit={handleImpersonate} className="flex gap-3">
                <input 
                  type="email" 
                  required 
                  className="flex-1 bg-slate-950 border border-slate-800 text-white px-6 py-4 rounded-2xl outline-none font-bold text-xs focus:border-red-600 transition-all" 
                  placeholder="Enter specific email..." 
                  value={formData.impersonateEmail} 
                  onChange={e => setFormData({...formData, impersonateEmail: e.target.value})} 
                />
                <button 
                  type="submit" 
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-8 rounded-2xl shadow-2xl transition-all uppercase text-[10px] tracking-widest"
                >
                  Bypass
                </button>
              </form>
            </div>
          </div>
        </div>
        <footer className="mt-20 text-slate-700 text-[9px] font-black uppercase tracking-[0.4em]">
          Powered by Rajan Dhamala and Associate
        </footer>
      </div>
    );
  }

  if (view === 'gateway') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 relative">
        <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-700">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-8">
              <Database className="text-white" size={40} />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tighter uppercase">ACCOUNTAID PRO</h1>
            <p className="text-slate-500 font-black uppercase text-[8px] md:text-[10px] tracking-[0.3em] md:tracking-[0.4em]">Enterprise Portal Access</p>
          </div>
          
          {!gatewayAction ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button 
                onClick={() => setGatewayAction('signin')}
                className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] flex flex-col items-center gap-6 hover:border-blue-500 transition-all group"
              >
                <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <LogIn size={32} />
                </div>
                <p className="text-sm font-black text-white uppercase tracking-widest">New Sign In</p>
              </button>
              <button 
                onClick={() => setGatewayAction('signup')}
                className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] flex flex-col items-center gap-6 hover:border-emerald-500 transition-all group"
              >
                <div className="w-16 h-16 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <Plus size={32} />
                </div>
                <p className="text-sm font-black text-white uppercase tracking-widest text-center">Create Workplace</p>
              </button>
              <button 
                onClick={() => setGatewayAction('team')}
                className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] flex flex-col items-center gap-6 hover:border-red-500 transition-all group"
              >
                <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                  <ShieldAlert size={32} />
                </div>
                <p className="text-sm font-black text-white uppercase tracking-widest text-center leading-tight">Superadmin Team Access</p>
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-[3.5rem] overflow-hidden shadow-2xl max-w-md mx-auto">
              <div className="flex items-center justify-between px-10 pt-10">
                <button 
                  onClick={() => { setGatewayAction(null); setError(''); }}
                  className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-all"
                >
                  <ArrowRight size={16} className="rotate-180" /> Back
                </button>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  {gatewayAction === 'signin' ? 'Authentication' : (gatewayAction === 'signup' ? 'Initialization' : 'Privileged Access')}
                </p>
              </div>
              
              <form onSubmit={handleGatewaySubmit} className="p-10 space-y-8">
                {error && (
                  <div className="p-4 bg-red-900/20 border border-red-900/50 text-red-400 text-[10px] font-black uppercase rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
                    <ShieldAlert size={16}/> {error}
                  </div>
                )}
                
                {gatewayAction === 'team' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-3">Team ID</label>
                      <input 
                        type="text" 
                        required 
                        className="w-full bg-slate-950 border border-slate-800 text-white px-6 py-5 rounded-3xl outline-none font-bold focus:border-red-600 transition-all" 
                        placeholder="TEAM_ID" 
                        value={formData.teamId} 
                        onChange={e => setFormData({...formData, teamId: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-3">Team Password</label>
                      <input 
                        type="password" 
                        required 
                        className="w-full bg-slate-950 border border-slate-800 text-white px-6 py-5 rounded-3xl outline-none font-bold focus:border-red-600 transition-all" 
                        placeholder="••••••••" 
                        value={formData.teamPass} 
                        onChange={e => setFormData({...formData, teamPass: e.target.value})} 
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-3">Registry Email</label>
                      <input 
                        type="email" 
                        required 
                        className="w-full bg-slate-950 border border-slate-800 text-white px-6 py-5 rounded-3xl outline-none font-bold focus:border-blue-600 transition-all" 
                        placeholder="admin@domain.com" 
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-3">Security Passphrase</label>
                      <input 
                        type="password" 
                        required 
                        className="w-full bg-slate-950 border border-slate-800 text-white px-6 py-5 rounded-3xl outline-none font-bold focus:border-blue-600 transition-all" 
                        placeholder="••••••••" 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                      />
                    </div>
                  </>
                )}
                
                <button 
                  disabled={isLoading} 
                  type="submit" 
                  className={`w-full ${gatewayAction === 'team' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black py-6 rounded-3xl shadow-2xl flex items-center justify-center gap-4 transition-all uppercase text-[11px] tracking-widest disabled:opacity-50`}
                >
                  {isLoading ? <RefreshCw size={24} className="animate-spin" /> : (
                    <>
                      {gatewayAction === 'signin' ? 'Enter Command Center' : (gatewayAction === 'signup' ? 'Initialize Workspace' : 'Verify Team Access')} 
                      <ArrowRight size={24} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
        <footer className="mt-20 text-slate-700 text-[9px] font-black uppercase tracking-[0.4em]">
          Powered by Rajan Dhamala and Associate
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 relative">
      <div className="w-full max-w-lg space-y-8 animate-in slide-in-from-bottom duration-700 flex-1 flex flex-col justify-center">
        <div className="text-center relative mb-8 md:mb-12">
           <div className="static md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 flex flex-col gap-2 mb-6 md:mb-0">
             <button 
               onClick={() => {
                 if (window.confirm("Return to the main gateway selection?")) {
                   onSuperAdminLogout(true);
                   onGatewayLogin(null);
                   localStorage.removeItem('accountaid_gateway_session');
                   setView('gateway');
                 }
               }} 
               className="flex items-center justify-center md:justify-start gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all"
             >
               <ArrowRight size={16} className="rotate-180" /> Sign Out to Gateway
             </button>
             {superAdminSession && (
               <button 
                 onClick={() => {
                   onGatewayLogin(null);
                   setView('superadmin-dashboard');
                 }} 
                 className="flex items-center justify-center md:justify-start gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-700 transition-all"
               >
                 <ShieldAlert size={16} /> Back to Team Console
               </button>
             )}
           </div>
           <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">ACCOUNTAID PRO</h1>
           <p className="text-slate-500 font-bold mt-4 bg-white border px-6 py-2 rounded-2xl inline-block text-[9px] md:text-[10px] uppercase tracking-widest">{gatewayUser?.email}</p>
        </div>

        {view === 'role' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
            <RoleCard 
              icon={<ShieldCheck className="w-10 h-10 md:w-14 md:h-14"/>} 
              label="SuperAdmin" 
              color="bg-emerald-50 text-emerald-600 hover:border-emerald-500" 
              onClick={() => {
                setError('');
                if (superAdminSession) {
                  onRoleLogin({ id: 'admin', name: 'Administrator', role: 'admin' });
                } else if (!state.adminPassword) {
                  setView('admin-setup');
                } else {
                  setView('admin-login');
                }
              }}
            />
            <RoleCard 
              icon={<User className="w-10 h-10 md:w-14 md:h-14"/>} 
              label="Operator" 
              color="bg-blue-50 text-blue-600 hover:border-blue-500" 
              onClick={() => {
                setError('');
                if (superAdminSession) {
                  onRoleLogin({ id: 'sa-operator', name: 'SuperAdmin Operator', role: 'user' });
                } else {
                  setView('user-login');
                }
              }}
            />
          </div>
        )}

        {(view === 'admin-setup' || view === 'admin-login' || view === 'user-login') && (
           <div className="bg-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl border-2 border-slate-100 relative">
             <div className="flex justify-between items-center mb-8 md:mb-10">
                <button 
                  type="button"
                  onClick={() => { setView('role'); setError(''); }} 
                  className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-all"
                >
                  <ArrowRight size={16} className="rotate-180" /> Back
                </button>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                  {view === 'admin-setup' ? 'Set Master PIN' : (view === 'user-login' ? 'Operator Login' : 'Authorized Access')}
                </h2>
                <div className="w-10"></div>
             </div>
             
             <form onSubmit={view === 'admin-setup' ? handleAdminSetup : (view === 'user-login' ? handleUserLogin : handleAdminLogin)} className="space-y-6 md:space-y-8">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-[10px] font-black uppercase rounded-2xl flex items-center gap-3">
                    <ShieldAlert size={16}/> {error}
                  </div>
                )}
                
                {view === 'user-login' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Username</label>
                      <input 
                        type="text" 
                        required 
                        className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 px-6 py-4 rounded-2xl font-bold text-sm outline-none focus:border-blue-600 transition-all" 
                        placeholder="operator_id" 
                        value={formData.userUser} 
                        onChange={e => setFormData({...formData, userUser: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Passphrase</label>
                      <input 
                        type="password" 
                        required 
                        className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 px-6 py-4 rounded-2xl font-bold text-sm outline-none focus:border-blue-600 transition-all" 
                        placeholder="••••••••" 
                        value={formData.userPass} 
                        onChange={e => setFormData({...formData, userPass: e.target.value})} 
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                      {view === 'admin-setup' ? 'Create a 4-digit Security PIN' : 'Master Security PIN'}
                    </label>
                    <input 
                      type="password" 
                      required 
                      autoFocus
                      className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 px-8 py-6 rounded-3xl font-black text-3xl md:text-5xl text-center outline-none focus:border-blue-600 transition-all tracking-[0.5em]" 
                      placeholder="••••" 
                      value={formData.adminPass} 
                      onChange={e => setFormData({...formData, adminPass: e.target.value.replace(/\D/g, '')})} 
                    />
                  </div>
                )}
                
                <button 
                  type="submit" 
                  className="w-full bg-slate-900 text-white font-black py-5 md:py-6 rounded-3xl uppercase text-[10px] md:text-[11px] tracking-widest shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-4"
                >
                  {view === 'admin-setup' ? 'Authorize Console' : 'Initialize Session'} 
                  <LogIn size={20}/>
                </button>
             </form>
           </div>
        )}
      </div>
      <footer className="py-10 text-slate-400 text-[9px] font-black uppercase tracking-[0.4em]">
        Powered by Rajan Dhamala and Associate
      </footer>
    </div>
  );
};

const RoleCard: React.FC<{ icon: any, label: string, color: string, onClick: () => void }> = ({ icon, label, color, onClick }) => (
  <button 
    type="button"
    onClick={onClick} 
    className={`bg-white border-2 border-slate-200 p-12 rounded-[3.5rem] transition-all group flex flex-col items-center gap-8 shadow-sm ${color}`}
  >
     <div className="p-6 bg-white rounded-[2rem] shadow-inner group-hover:scale-110 transition-transform">{icon}</div>
     <p className="text-xl font-black uppercase tracking-tight text-slate-900">{label}</p>
  </button>
);

export default Login;
