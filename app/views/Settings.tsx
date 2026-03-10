
import React, { useState, useMemo } from 'react';
import { AppState, Location, DateSystem, Party, SuperAdminSession } from '../types';
import { ShieldCheck, Smartphone, Lock, Key, Users, UserPlus, Trash2, MapPin, Plus, X, ShieldAlert, Calendar, Building2, Wallet, ShieldAlert as ShieldIcon, Pause, Play, Calculator, Printer } from 'lucide-react';

interface SettingsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeUser: any;
  isMainDevice: boolean;
  superAdminSession: SuperAdminSession | null;
}

const Settings: React.FC<SettingsProps> = ({ state, setState, activeUser, isMainDevice, superAdminSession }) => {
  const [newLocName, setNewLocName] = useState('');
  const [verifyOldPin, setVerifyOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newUser, setNewUser] = useState({ name: '', user: '', pass: '', role: 'user' as 'admin' | 'user' });
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newTreasury, setNewTreasury] = useState({ name: '', type: 'treasury' as const, treasurySubtype: 'Bank' });

  const isAdmin = activeUser.role === 'admin' || !!superAdminSession;

  const pinPolicy = useMemo(() => {
    if (!state.settings.securityPinSet) return { canChange: true, daysUntilNextChange: 0, isInitial: true };
    const lastChange = new Date(state.settings.lastPinChangeDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastChange.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { canChange: diffDays >= 30, daysUntilNextChange: Math.max(0, 30 - diffDays), isInitial: false };
  }, [state.settings.lastPinChangeDate, state.settings.securityPinSet]);

  const updatePin = () => {
    if (!isMainDevice) return alert("Restricted: PIN updates only allowed from the Main Hardware Console.");
    if (!pinPolicy.canChange) return alert(`Cooldown: You can only refresh the Security PIN once per month. Next change allowed in ${pinPolicy.daysUntilNextChange} days.`);
    if (!pinPolicy.isInitial && verifyOldPin !== state.settings.securityPin) return alert("Verification Error: The current Security PIN is incorrect.");
    if (newPin.length !== 4) return alert("System Constraint: Security PIN must be exactly 4 digits.");
    
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, securityPin: newPin, securityPinSet: true, lastPinChangeDate: new Date().toISOString().split('T')[0] }
    }));
    setVerifyOldPin(''); setNewPin('');
    alert("Success: Master Security PIN has been synchronized.");
  };

  const handleAddUser = () => {
    if (!editingUser && state.managedUsers.length >= 5) return alert("Limit: Workspace supports max 5 staff users.");
    if (!newUser.name || !newUser.user || !newUser.pass) return alert("Validation: All fields are required.");
    
    if (editingUser) {
      setState(prev => ({
        ...prev,
        managedUsers: prev.managedUsers.map(u => u.id === editingUser ? { ...u, name: newUser.name, username: newUser.user, password: newUser.pass, role: newUser.role } : u)
      }));
      setEditingUser(null);
    } else {
      setState(prev => ({ ...prev, managedUsers: [...prev.managedUsers, { id: crypto.randomUUID(), name: newUser.name, username: newUser.user, password: newUser.pass, role: newUser.role }] }));
    }
    setNewUser({ name: '', user: '', pass: '', role: 'user' });
  };

  const startEditUser = (user: any) => {
    setEditingUser(user.id);
    setNewUser({ name: user.name, user: user.username, pass: user.password, role: user.role || 'user' });
  };

  const handleAddTreasury = () => {
    if (!newTreasury.name.trim()) return;
    const account: Party = {
      id: `treasury-${crypto.randomUUID()}`,
      name: newTreasury.name.trim(),
      phone: '-',
      type: 'treasury',
      balance: 0,
      createdBy: activeUser.name,
      isSystemAccount: false
    };
    setState(prev => ({ ...prev, parties: [...prev.parties, account] }));
    setNewTreasury({ name: '', type: 'treasury', treasurySubtype: 'Bank' });
  };

  const removeTreasury = (id: string) => {
    const account = state.parties.find(p => p.id === id);
    if (account?.balance !== 0) return alert("Security: Accounts with active balances cannot be removed. Settle balance to zero first.");
    if (account?.isSystemAccount) return alert("Restricted: System core accounts cannot be removed.");
    setState(prev => ({ ...prev, parties: prev.parties.filter(p => p.id !== id) }));
  };

  const handleAddLocation = () => {
    if (!newLocName.trim()) return;
    const newLoc: Location = { id: crypto.randomUUID(), name: newLocName.trim() };
    setState(prev => ({ ...prev, locations: [...prev.locations, newLoc] }));
    setNewLocName('');
  };

  const removeLocation = (id: string) => {
    if (id === 'default') return alert("Restricted: Main Godown cannot be deleted.");
    const hasInventory = state.inventory.some(item => item.locationId === id && item.quantity > 0);
    if (hasInventory) return alert("Restricted: This location has active stock. Relocate items before removal.");
    setState(prev => ({ ...prev, locations: prev.locations.filter(l => l.id !== id) }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">System Configuration</h1><p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">{activeUser.name} • {isMainDevice ? 'Admin Console' : 'Remote Terminal'}</p></div>
        <div className={`flex items-center gap-3 px-6 py-3 rounded-3xl border shadow-sm ${isMainDevice ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
           {isMainDevice ? <ShieldCheck size={20}/> : <Smartphone size={20}/>}
           <p className="text-[10px] font-black uppercase tracking-widest">{isMainDevice ? 'Main Console' : 'Remote Node'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <section className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
             <div className="p-8 border-b bg-slate-50 flex items-center justify-between"><h2 className="text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter"><Building2 className="text-blue-600" size={24} /> Treasury Management</h2></div>
             <div className="p-10 space-y-6">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Register Bank/Wallet A/C</p>
                  <div className="flex gap-3">
                    <input className="flex-1 px-5 py-4 bg-white border rounded-2xl outline-none font-black text-xs uppercase" placeholder="A/C Title (e.g. Nabil Bank)" value={newTreasury.name} onChange={e => setNewTreasury({...newTreasury, name: e.target.value})} />
                    <button onClick={handleAddTreasury} className="bg-blue-600 text-white px-8 rounded-2xl font-black text-[11px] uppercase shadow-lg hover:bg-blue-700 transition-all">Add</button>
                  </div>
                </div>
                <div className="space-y-3">
                  {state.parties.filter(p => p.type === 'treasury').map(p => (
                    <div key={p.id} className="flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-[2rem] hover:border-blue-100 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                           {p.name.toLowerCase().includes('wallet') ? <Wallet size={18}/> : <Building2 size={18}/>}
                        </div>
                        <div><p className="font-black text-slate-900 uppercase text-xs tracking-tight">{p.name}</p><p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{state.settings.currency} {p.balance.toLocaleString()}</p></div>
                      </div>
                      {!p.isSystemAccount && <button onClick={() => removeTreasury(p.id)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>}
                    </div>
                  ))}
                </div>
             </div>
          </section>

           <section className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
             <div className="p-8 border-b bg-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter">
                   <MapPin className="text-red-600" size={24} /> Godown Management
                </h2>
             </div>
             <div className="p-10 space-y-6">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Add New Location</p>
                  <div className="flex gap-3">
                    <input className="flex-1 px-5 py-4 bg-white border rounded-2xl outline-none font-black text-xs uppercase" placeholder="Godown Name (e.g. Warehouse B)" value={newLocName} onChange={e => setNewLocName(e.target.value)} />
                    <button onClick={handleAddLocation} className="bg-blue-600 text-white px-8 rounded-2xl font-black text-[11px] uppercase shadow-lg hover:bg-blue-700 transition-all">Add</button>
                  </div>
                </div>
                <div className="space-y-3">
                   {state.locations.map(loc => (
                      <div key={loc.id} className="flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-[2rem] hover:border-blue-100 transition-all">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                               <MapPin size={18}/>
                            </div>
                            <div>
                               <p className="font-black text-slate-900 uppercase text-xs tracking-tight">{loc.name}</p>
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  {state.inventory.filter(i => i.locationId === loc.id).length} Items Tracked
                               </p>
                            </div>
                         </div>
                         {loc.id !== 'default' && <button onClick={() => removeLocation(loc.id)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>}
                      </div>
                   ))}
                </div>
             </div>
          </section>

          <section className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
             <div className="p-8 border-b bg-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter">
                   <Calculator className="text-indigo-600" size={24} /> Tax & VAT Configuration
                </h2>
             </div>
             <div className="p-10 space-y-6">
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div>
                    <p className="font-black text-slate-900 uppercase text-sm">Enable VAT System</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apply VAT to transactions</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={state.settings.vatEnabled} onChange={e => setState(prev => ({ ...prev, settings: { ...prev.settings, vatEnabled: e.target.checked } }))} />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                {state.settings.vatEnabled && (
                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Default VAT Rate (%)</label>
                    <input type="number" className="w-full px-6 py-4 bg-white border rounded-2xl outline-none font-black text-sm" value={state.settings.vatRate} onChange={e => setState(prev => ({ ...prev, settings: { ...prev.settings, vatRate: parseFloat(e.target.value) || 0 } }))} />
                  </div>
                )}
             </div>
          </section>

          <section className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
             <div className="p-8 border-b bg-slate-50 flex items-center justify-between">
                <h2 className="text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter">
                   <Printer className="text-emerald-600" size={24} /> Printer Setup
                </h2>
             </div>
             <div className="p-10 space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Default Printer Format</label>
                  <select className="w-full bg-slate-50 px-6 py-4 rounded-2xl outline-none font-black text-slate-900 border focus:border-emerald-500 transition-all uppercase text-sm" value={state.settings.printerType || ''} onChange={e => setState(prev => ({...prev, settings: {...prev.settings, printerType: e.target.value as any}}))}>
                    <option value="" disabled>Select Printer Format...</option>
                    <option value="local">Local Printer (A4/Standard)</option>
                    <option value="thermal80">Thermal Printer (80mm)</option>
                    <option value="network">Online/Network Printer</option>
                    <option value="pdf">Print to PDF</option>
                  </select>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 ml-4">Select the format for generating bills and reports.</p>
                </div>
             </div>
          </section>
        </div>

        <div className="space-y-8">
           {isAdmin && (
             <section className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
                 <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                   <h2 className="text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter">
                     <Users className="text-blue-600" size={24} /> Staff Control Room ({state.managedUsers.length}/5)
                   </h2>
                 </div>
                <div className="p-10 space-y-8">
                   {(state.managedUsers.length < 5 || editingUser) && (
                     <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] shadow-inner space-y-4">
                       <div className="flex justify-between items-center mb-2">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{editingUser ? 'Edit Staff Member' : 'Register New Staff'}</p>
                         {editingUser && <button onClick={() => { setEditingUser(null); setNewUser({ name: '', user: '', pass: '', role: 'user' }); }} className="text-[10px] font-black text-red-500 uppercase">Cancel</button>}
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <input className="px-5 py-4 bg-white border rounded-2xl outline-none font-black text-xs uppercase" placeholder="Full Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                         <input className="px-5 py-4 bg-white border rounded-2xl outline-none font-black text-xs" placeholder="Login User" value={newUser.user} onChange={e => setNewUser({...newUser, user: e.target.value})} />
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <input type={superAdminSession ? "text" : "password"} placeholder="Passphrase" className="px-5 py-4 bg-white border rounded-2xl outline-none font-black text-xs" value={newUser.pass} onChange={e => setNewUser({...newUser, pass: e.target.value})} />
                         <select className="px-5 py-4 bg-white border rounded-2xl outline-none font-black text-xs uppercase" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as 'admin' | 'user'})}>
                           <option value="user">Operator</option>
                           <option value="admin">Admin</option>
                         </select>
                       </div>
                       <button onClick={handleAddUser} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                         {editingUser ? 'Update Credentials' : 'Create Access'} <UserPlus size={18}/>
                       </button>
                     </div>
                   )}
                   <div className="space-y-3">
                     {state.managedUsers.map(u => (
                       <div key={u.id} className="flex items-center justify-between p-6 bg-white border-2 border-slate-50 rounded-[2rem] hover:border-blue-100 transition-all">
                         <div>
                           <p className="font-black text-slate-900 uppercase tracking-tight leading-none mb-1">
                             {u.name} {u.isPaused && <span className="text-amber-500 ml-2 text-[10px]">(PAUSED)</span>}
                           </p>
                           <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">@{u.username} • {u.role || 'user'}</p>
                           {superAdminSession && (
                             <p className="text-[9px] text-indigo-500 font-black uppercase tracking-widest mt-1">Pass: {u.password}</p>
                           )}
                         </div>
                         <div className="flex gap-2">
                           <button onClick={() => setState(prev => ({ ...prev, managedUsers: prev.managedUsers.map(x => x.id === u.id ? { ...x, isPaused: !x.isPaused } : x) }))} className="p-3 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all" title={u.isPaused ? "Resume User" : "Pause User"}>
                             {u.isPaused ? <Play size={18}/> : <Pause size={18}/>}
                           </button>
                           <button onClick={() => startEditUser(u)} className="p-3 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><ShieldCheck size={18}/></button>
                           {(!!superAdminSession || u.id !== activeUser.id) && (
                             <button onClick={() => setState(prev => ({ ...prev, managedUsers: prev.managedUsers.filter(x => x.id !== u.id) }))} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                           )}
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
             </section>
           )}

           <section className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center"><h2 className="text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter"><Lock className="text-indigo-600" size={24} /> {pinPolicy.isInitial ? 'Set Security PIN' : 'Security Perimeter'}</h2></div>
            <div className="p-10 space-y-6">
               {!pinPolicy.isInitial && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Current Verification PIN</label>
                    <input disabled={!pinPolicy.canChange || !isMainDevice} type="password" maxLength={4} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-[2rem] px-8 py-4 text-slate-900 font-black text-4xl outline-none text-center tracking-[0.5em]" value={verifyOldPin} onChange={e => setVerifyOldPin(e.target.value.replace(/\D/g, ''))} />
                  </div>
               )}
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{pinPolicy.isInitial ? 'Establish First Security PIN' : 'New Security PIN'}</label>
                 <input disabled={!pinPolicy.canChange || !isMainDevice} type="password" maxLength={4} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-[2rem] px-8 py-4 text-slate-900 font-black text-4xl outline-none text-center tracking-[0.5em]" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
               </div>
               <button disabled={!pinPolicy.canChange || !isMainDevice} onClick={updatePin} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-slate-800 disabled:opacity-50 transition-all"><Key size={18}/> {pinPolicy.isInitial ? 'Initialize Security PIN' : 'Sync New PIN'}</button>
            </div>
          </section>

           <section className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
              <div className="p-8 border-b bg-slate-50 flex items-center justify-between"><h2 className="text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter"><Building2 className="text-blue-600" size={24} /> Company Profile</h2></div>
              <div className="p-10 space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Company Name</label>
                    <input className="w-full bg-slate-50 px-6 py-4 rounded-2xl outline-none font-black text-slate-900 border focus:border-blue-500 transition-all" value={state.settings.companyName || ''} onChange={e => setState(prev => ({...prev, settings: {...prev.settings, companyName: e.target.value}}))} placeholder="Your Company Name" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Company Address</label>
                    <input className="w-full bg-slate-50 px-6 py-4 rounded-2xl outline-none font-black text-slate-900 border focus:border-blue-500 transition-all" value={state.settings.companyAddress || ''} onChange={e => setState(prev => ({...prev, settings: {...prev.settings, companyAddress: e.target.value}}))} placeholder="Company Address" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">PAN / VAT Number</label>
                      <input className="w-full bg-slate-50 px-6 py-4 rounded-2xl outline-none font-black text-slate-900 border focus:border-blue-500 transition-all" value={state.settings.companyPan || ''} onChange={e => setState(prev => ({...prev, settings: {...prev.settings, companyPan: e.target.value}}))} placeholder="PAN/VAT Number" />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Telephone / Contact</label>
                      <input className="w-full bg-slate-50 px-6 py-4 rounded-2xl outline-none font-black text-slate-900 border focus:border-blue-500 transition-all" value={state.settings.companyPhone || ''} onChange={e => setState(prev => ({...prev, settings: {...prev.settings, companyPhone: e.target.value}}))} placeholder="Contact Number" />
                   </div>
                 </div>
              </div>
           </section>

           <section className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
              <div className="p-8 border-b bg-slate-50 flex items-center justify-between"><h2 className="text-lg font-black flex items-center gap-3 text-slate-900 uppercase tracking-tighter"><Calendar className="text-emerald-600" size={24} /> Regional Localization</h2></div>
              <div className="p-10 space-y-6">
                 <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-3 block">Display Calendar System</label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-3xl">
                     {[DateSystem.AD, DateSystem.BS].map(sys => (
                       <button key={sys} onClick={() => setState(prev => ({...prev, settings: {...prev.settings, dateSystem: sys}}))} className={`py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${state.settings.dateSystem === sys ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{sys} Format</button>
                     ))}
                  </div>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Currency Symbol</label>
                   <input className="w-full bg-slate-50 px-6 py-4 rounded-2xl outline-none font-black text-slate-900 border focus:border-emerald-500 transition-all" value={state.settings.currency} onChange={e => setState(prev => ({...prev, settings: {...prev.settings, currency: e.target.value}}))} />
                </div>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
