import { db } from "../firebase"; // दुईवटा थोप्लो (../) किनभने firebase.js बाहिर छ
import { collection, addDoc, getDocs, onSnapshot } from "firebase/firestore";
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, Users, Wrench, 
  Settings as SettingsIcon, LogOut, Database, BarChart3,
  CloudUpload, Receipt, ArrowLeftRight, Landmark
} from 'lucide-react';
import { AppState, DateSystem, SuperAdminSession } from './types';
import Dashboard from './views/Dashboard';
import Inventory from './views/Inventory';
import Parties from './views/Parties';
import Repairs from './views/Repairs';
import Transactions from './views/Transactions';
import Settings from './views/Settings';
import Login from './views/Login';
import Reports from './views/Reports';
import Backup from './views/Backup';
import StockTransfer from './views/StockTransfer';
import Treasury from './views/Treasury';

const CASH_ACCOUNT_ID = 'treasury-cash';
const BANK_ACCOUNT_ID = 'treasury-bank';
const WALLET_ACCOUNT_ID = 'treasury-wallet';

const getInitialState = (): AppState => ({
  inventory: [],
  parties: [
    { id: CASH_ACCOUNT_ID, name: 'Cash A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
    { id: BANK_ACCOUNT_ID, name: 'Bank A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
    { id: WALLET_ACCOUNT_ID, name: 'Wallet A/C', phone: '-', type: 'treasury', balance: 0, createdBy: 'System', isSystemAccount: true },
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
    dateSystem: DateSystem.AD,
    currency: 'Rs.',
    securityPin: '',
    securityPinSet: false,
    lastPinChangeDate: new Date().toISOString().split('T')[0],
    vatEnabled: false,
    vatRate: 13,
    companyName: '',
    companyPan: '',
    companyAddress: '',
  },
});

const App: React.FC = () => {
  const [gatewayUser, setGatewayUser] = useState<any>(() => {
    const saved = localStorage.getItem('accountaid_gateway_session');
    return saved ? JSON.parse(saved) : null;
useEffect(() => {
  const saveData = async () => {
    if (gatewayUser && state.hasUnsavedChanges) {
      const docRef = doc(db, "user_states", `state_${gatewayUser.email}`);
      try {
        await setDoc(docRef, {
          ...state,
          hasUnsavedChanges: false,
          lastSync: new Date().toISOString()
        });
      } catch (error) {
        console.error("Sync Error:", error);
      }
    }
  };
   useEffect(() => {
  const saveData = async () => {
    if (gatewayUser && state.hasUnsavedChanges) {
      const docRef = doc(db, "user_states", `state_${gatewayUser.email}`);
      try {
        // यहाँ { } भित्र डेटा राख्नुपर्छ
        await setDoc(docRef, {
          ...state,
          hasUnsavedChanges: false,
          lastSync: new Date().toISOString()
        });
        console.log("Cloud sync successful!");
      } catch (error) {
        console.error("Sync Error:", error);
      }
    }
  };
  saveData();
}, [state, gatewayUser]);
        useEffect(() => {
  const loadData = async () => {
    if (gatewayUser) {
      // सेसनलाई लोकलमै राख्न दिने
      localStorage.setItem('accountaid_gateway_session', JSON.stringify(gatewayUser));
      
      const docRef = doc(db, "user_states", `state_${gatewayUser.email}`);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setState(docSnap.data() as AppState);
        } else {
          setState(getInitialState());
        }
      } catch (error) {
        console.error("Firebase Error:", error);
      }
    }
  };
  loadData();
}, [gatewayUser]);
      
      const storageKey = `accountaid_state_pro_${gatewayUser.email}`;
      const docRef = doc(db, "user_states", storageKey);
      
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          // यदि क्लाउडमा डेटा छ भने त्यो लोड गर्ने
          setState(docSnap.data() as AppState);
        } else {
          // यदि छैन भने सुरुको खाली स्टेट राख्ने
          setState(getInitialState());
        }
      } catch (error) {
        console.error("Cloud बाट डेटा तान्न सकिएन:", error);
        setState(getInitialState());
      }
    }
  };

  loadDataFromCloud();
}, [gatewayUser]);
            parsed.settings.vatRate = 13;
          }
          setState({ ...parsed, hasUnsavedChanges: false });
        } catch (e) {
          setState(getInitialState());
        }
      } else {
        setState(getInitialState());
      }
    } else {
      setState(getInitialState());
    }
  }, [gatewayUser]);

  useEffect(() => {
    if (activeUser) {
      localStorage.setItem('accountaid_active_session', JSON.stringify(activeUser));
    } else {
      localStorage.removeItem('accountaid_active_session');
    }
  }, [activeUser]);

  useEffect(() => {
    if (gatewayUser && state.hasUnsavedChanges) {
      const storageKey = `accountaid_state_pro_${gatewayUser.email}`;
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [state, gatewayUser]);

  const handleLogout = (force = false) => {
    if (force || window.confirm("Are you sure you want to sign out and return to the main gateway?")) {
      localStorage.removeItem('accountaid_gateway_session');
      localStorage.removeItem('accountaid_active_session');
      setGatewayUser(null);
      setActiveUser(null);
      setSuperAdminSession(null);
    }
  };

  const handleReturnToGateway = () => {
    handleLogout();
  };

  const handleSuperAdminLogout = (force = false) => {
    if (force || window.confirm("Terminate SuperAdmin session and return to gateway?")) {
      setSuperAdminSession(null);
      setGatewayUser(null);
      setActiveUser(null);
      localStorage.removeItem('accountaid_gateway_session');
      localStorage.removeItem('accountaid_active_session');
    }
  };

  if (!gatewayUser || !activeUser) {
    return (
      <Login 
        state={state} 
        setState={setState} 
        gatewayUser={gatewayUser}
        onGatewayLogin={setGatewayUser} 
        onRoleLogin={setActiveUser}
        isMainDevice={state.mainDeviceId !== null}
        superAdminSession={superAdminSession}
        onSuperAdminLogin={setSuperAdminSession}
        onSuperAdminLogout={handleSuperAdminLogout}
      />
    );
  }

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50">
        <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col hidden md:flex">
          <div className="p-8">
            <h1 className="text-2xl font-black text-blue-400 flex items-center gap-2 tracking-tighter uppercase">
              <Database size={24} /> ACCOUNTAID
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">v2.5 Pro Edition</p>
            {state.settings.companyName && (
              <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mt-4 border-t border-slate-800 pt-4 break-words">
                {state.settings.companyName}
              </p>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <SidebarLink to="/transactions" icon={<Receipt size={20} />} label="Transactions" />
            <SidebarLink to="/treasury" icon={<Landmark size={20} />} label="Treasury" />
            <SidebarLink to="/transfer" icon={<ArrowLeftRight size={20} />} label="Stock Move" />
            <SidebarLink to="/inventory" icon={<Package size={20} />} label="Stock Master" />
            <SidebarLink to="/repairs" icon={<Wrench size={20} />} label="Service Desk" />
            <SidebarLink to="/parties" icon={<Users size={20} />} label="Ledgers" />
            <SidebarLink to="/reports" icon={<BarChart3 size={20} />} label="Analytics" />
            <SidebarLink to="/backup" icon={<CloudUpload size={20} />} label="Vault Sync" />
            <SidebarLink to="/settings" icon={<SettingsIcon size={20} />} label="Config" />
          </nav>

          <div className="p-6 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-6 bg-slate-800/50 p-3 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black">
                {activeUser.name.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-black uppercase truncate">{activeUser.name}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{activeUser.role}</p>
              </div>
            </div>
            <button onClick={handleReturnToGateway} className="w-full flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all mb-1">
              <LayoutDashboard size={16} /> Main Menu
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-red-600/10 hover:text-red-400 rounded-xl transition-all">
              <LogOut size={16} /> Sign Out
            </button>
            <p className="mt-6 text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] text-center">
              Powered by Rajan Dhamala and Associate
            </p>
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
          <header className="h-16 bg-white border-b flex items-center justify-between px-6 md:hidden">
             <div>
               <h1 className="text-xl font-black text-blue-600 uppercase tracking-tighter">ACCOUNTAID</h1>
               {state.settings.companyName && (
                 <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none truncate max-w-[150px]">
                   {state.settings.companyName}
                 </p>
               )}
             </div>
             <div className="flex items-center gap-2">
               <button onClick={handleReturnToGateway} className="p-2 text-slate-400 hover:text-slate-900"><LayoutDashboard size={20} /></button>
               <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600"><LogOut size={20} /></button>
             </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-10 flex flex-col">
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<Dashboard state={state} />} />
                <Route path="/transactions" element={<Transactions state={state} setState={(s) => setState(prev => ({...prev, ...(typeof s === 'function' ? s(prev) : s), hasUnsavedChanges: true}))} activeUser={activeUser} superAdminSession={superAdminSession} />} />
                <Route path="/treasury" element={<Treasury state={state} setState={(s) => setState(prev => ({...prev, ...(typeof s === 'function' ? s(prev) : s), hasUnsavedChanges: true}))} activeUser={activeUser} superAdminSession={superAdminSession} />} />
                <Route path="/transfer" element={<StockTransfer state={state} setState={(s) => setState(prev => ({...prev, ...(typeof s === 'function' ? s(prev) : s), hasUnsavedChanges: true}))} superAdminSession={superAdminSession} />} />
                <Route path="/inventory" element={<Inventory state={state} setState={(s) => setState(prev => ({...prev, ...(typeof s === 'function' ? s(prev) : s), hasUnsavedChanges: true}))} activeUser={activeUser} superAdminSession={superAdminSession} />} />
                <Route path="/repairs" element={<Repairs state={state} setState={(s) => setState(prev => ({...prev, ...(typeof s === 'function' ? s(prev) : s), hasUnsavedChanges: true}))} activeUser={activeUser} superAdminSession={superAdminSession} />} />
                <Route path="/parties" element={<Parties state={state} setState={(s) => setState(prev => ({...prev, ...(typeof s === 'function' ? s(prev) : s), hasUnsavedChanges: true}))} activeUser={activeUser} superAdminSession={superAdminSession} />} />
                <Route path="/reports" element={<Reports state={state} />} />
                <Route path="/backup" element={<Backup state={state} setState={setState} />} />
                <Route path="/settings" element={<Settings state={state} setState={(s) => setState(prev => ({...prev, ...(typeof s === 'function' ? s(prev) : s), hasUnsavedChanges: true}))} activeUser={activeUser} isMainDevice={state.mainDeviceId !== null} superAdminSession={superAdminSession} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            <footer className="mt-10 pt-6 border-t text-center text-slate-400 text-[9px] font-black uppercase tracking-[0.4em]">
              Powered by Rajan Dhamala and Associate
            </footer>
          </div>
        </main>
      </div>
    </Router>
  );
};

const SidebarLink: React.FC<{ to: string, icon: React.ReactNode, label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all group ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>
      <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} transition-colors`}>{icon}</span>
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
    </Link>
  );
};

export default App;
