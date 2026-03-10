
import React, { useState, useMemo } from 'react';
import { AppState, Party, PaymentMethod, Transaction, SuperAdminSession } from '../types';
import { 
  Landmark, ArrowUpCircle, ArrowDownCircle, Calculator, 
  Settings2, CircleCheckBig, X, Plus, Minus, Coins,
  TrendingUp, TrendingDown, Clock, Search, ListFilter, DollarSign,
  Banknote, Wallet, Receipt, ArrowRightLeft, ArrowRight, Edit2
} from 'lucide-react';
import { formatAppDate, getCurrentDateStr } from '../utils/dateUtils';
import PinModal from '../components/PinModal';

interface TreasuryProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeUser: any;
  superAdminSession: SuperAdminSession | null;
}

const Treasury: React.FC<TreasuryProps> = ({ state, setState, activeUser, superAdminSession }) => {
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newOpeningBal, setNewOpeningBal] = useState<number>(0);
  const [openingDenoms, setOpeningDenoms] = useState<Record<number, number>>({
    1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  });

  const [editName, setEditName] = useState('');
  const [transferData, setTransferData] = useState({ fromId: '', toId: '', amount: 0, description: '' });
  const [transferDenoms, setTransferDenoms] = useState<Record<number, number>>({
    1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  });

  const accounts = state.parties.filter(p => p.type === 'treasury');
  
  const flows = useMemo(() => {
    const txs = state.transactions;
    const inflow = txs.filter(t => ['sale', 'receipt', 'income'].includes(t.type));
    const outflow = txs.filter(t => ['purchase', 'payment', 'expense'].includes(t.type));
    return { inflow, outflow };
  }, [state.transactions]);

  const denomTotal = useMemo(() => 
    (Object.entries(openingDenoms) as [string, number][]).reduce((sum, [val, qty]) => sum + (Number(val) * qty), 0)
  , [openingDenoms]);

  const transferDenomTotal = useMemo(() => 
    (Object.entries(transferDenoms) as [string, number][]).reduce((sum, [val, qty]) => sum + (Number(val) * qty), 0)
  , [transferDenoms]);

  const handleEditOpening = (acc: Party) => {
    setSelectedAccountId(acc.id);
    setNewOpeningBal(acc.balance); 
    if (acc.id === 'treasury-cash') setOpeningDenoms({ ...state.cashVault });
    
    if (superAdminSession) {
      setIsAdjustmentModalOpen(true);
    } else {
      setIsPinModalOpen(true);
    }
  };

  const handleEditName = (acc: Party) => {
    setSelectedAccountId(acc.id);
    setEditName(acc.name);
    setIsEditNameModalOpen(true);
  };

  const commitNameChange = () => {
    if (!selectedAccountId) return;
    setState(prev => ({
      ...prev,
      parties: prev.parties.map(p => p.id === selectedAccountId ? { ...p, name: editName } : p)
    }));
    setIsEditNameModalOpen(false);
  };

  const handleInternalTransfer = () => {
    if (!transferData.fromId || !transferData.toId || transferData.amount <= 0) return alert("Complete all transfer fields.");
    if (transferData.fromId === transferData.toId) return alert("Source and Destination must be different.");
    
    const isSourceCash = transferData.fromId === 'treasury-cash';
    const isDestCash = transferData.toId === 'treasury-cash';
    
    if ((isSourceCash || isDestCash) && transferDenomTotal !== transferData.amount) {
      return alert(`Cash Denomination Mismatch:\nExpected: ${transferData.amount}\nProvided: ${transferDenomTotal}`);
    }

    const tx: Transaction = {
      id: crypto.randomUUID(),
      date: getCurrentDateStr(),
      time: new Date().toLocaleTimeString(),
      fromPartyId: transferData.fromId,
      toPartyId: transferData.toId,
      locationId: 'default',
      totalAmount: transferData.amount,
      type: 'transfer',
      paymentMethod: transferData.fromId, 
      description: transferData.description || `Internal Transfer: ${state.parties.find(p=>p.id===transferData.fromId)?.name} ➔ ${state.parties.find(p=>p.id===transferData.toId)?.name}`,
      createdBy: activeUser.name,
      receivedDenominations: isDestCash ? transferDenoms : undefined,
      returnedDenominations: isSourceCash ? transferDenoms : undefined
    };

    setState(prev => {
      let updatedParties = prev.parties.map(p => {
        if (p.id === transferData.fromId) return { ...p, balance: p.balance - transferData.amount };
        if (p.id === transferData.toId) return { ...p, balance: p.balance + transferData.amount };
        return p;
      });

      let updatedVault = { ...prev.cashVault };
      if (isSourceCash) {
        (Object.entries(transferDenoms) as [string, number][]).forEach(([v, q]) => updatedVault[Number(v)] -= q);
      }
      if (isDestCash) {
        (Object.entries(transferDenoms) as [string, number][]).forEach(([v, q]) => updatedVault[Number(v)] += q);
      }

      return { ...prev, parties: updatedParties, cashVault: updatedVault, transactions: [tx, ...prev.transactions] };
    });

    setIsTransferModalOpen(false);
    setTransferData({ fromId: '', toId: '', amount: 0, description: '' });
    setTransferDenoms({ 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
  };

  const commitOpeningBalance = () => {
    if (!selectedAccountId) return;
    setState(prev => {
      const updatedParties = prev.parties.map(p => {
        if (p.id === selectedAccountId) return { ...p, balance: selectedAccountId === 'treasury-cash' ? denomTotal : newOpeningBal };
        return p;
      });
      let updatedVault = { ...prev.cashVault };
      if (selectedAccountId === 'treasury-cash') updatedVault = { ...openingDenoms };
      return { ...prev, parties: updatedParties, cashVault: updatedVault };
    });
    setIsAdjustmentModalOpen(false);
    setSelectedAccountId(null);
  };

  const filteredTxs = useMemo(() => {
    const all = state.transactions.filter(t => t.type === 'transfer' || t.paymentMethod !== 'Credit').sort((a,b) => b.date.localeCompare(a.date));
    return all.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [state.transactions, searchTerm]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">All Treasury</h1>
          <p className="text-slate-500 font-bold uppercase text-[9px] md:text-[10px] mt-2 md:mt-3 tracking-[0.2em]">Consolidated Asset & Liquidity Workbench</p>
        </div>
        <button onClick={() => setIsTransferModalOpen(true)} className="w-full md:w-auto bg-slate-900 text-white px-8 md:px-10 py-4 md:py-5 rounded-3xl md:rounded-[2rem] font-black text-[10px] uppercase shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
          <ArrowRightLeft size={18}/> Transfer Funds
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${acc.id === 'treasury-cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  {acc.id === 'treasury-cash' ? <Banknote size={28}/> : (acc.name.toLowerCase().includes('wallet') ? <Wallet size={28}/> : <Landmark size={28}/>)}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditName(acc)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit2 size={16}/></button>
                  <button onClick={() => handleEditOpening(acc)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Settings2 size={16}/></button>
                </div>
              </div>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2 truncate max-w-[80%]">{acc.name}</p>
              <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{state.settings.currency} {acc.balance.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
        <div className="p-10 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-200"><ListFilter size={24}/></div>
             <div><h2 className="text-xl font-black uppercase tracking-tight leading-none">Liquidity Census</h2><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Internal & External Flow Logs</p></div>
           </div>
           <div className="flex-1 max-w-md w-full relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" placeholder="Lookup activity..." className="w-full bg-white border border-slate-200 pl-12 pr-6 py-4 rounded-2xl font-black text-sm uppercase outline-none focus:border-blue-600 shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
              <tr><th className="px-10 py-6">Identity</th><th className="px-10 py-6">Flow Classification</th><th className="px-10 py-6 text-right">Magnitude</th><th className="px-10 py-6 text-center">Account / Route</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTxs.map(tx => {
                const isInflow = ['sale', 'receipt', 'income'].includes(tx.type);
                const isTransfer = tx.type === 'transfer';
                const accName = isTransfer ? 'Internal Transfer' : (state.parties.find(p=>p.id===tx.paymentMethod)?.name || 'Direct Route');
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50">
                    <td className="px-10 py-8"><p className="font-black text-slate-900 text-sm uppercase leading-none">{tx.description}</p><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1.5">{formatAppDate(tx.date, state.settings.dateSystem)} • {tx.time}</p></td>
                    <td className="px-10 py-8">
                       <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase border-2 flex items-center gap-2 w-fit ${isTransfer ? 'bg-blue-50 text-blue-600 border-blue-100' : isInflow ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                          {isTransfer ? <ArrowRightLeft size={12}/> : isInflow ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                          {isTransfer ? 'TRANSFER' : isInflow ? 'INFLOW' : 'OUTFLOW'}
                       </span>
                    </td>
                    <td className="px-10 py-8 text-right font-black text-lg tracking-tighter text-slate-900">{state.settings.currency} {tx.totalAmount.toLocaleString()}</td>
                    <td className="px-10 py-8 text-center font-black text-[10px] text-slate-400 uppercase tracking-widest">{accName}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT NAME MODAL */}
      {isEditNameModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-300">
            <h2 className="text-xl font-black text-slate-900 uppercase mb-6">Rename Account</h2>
            <input autoFocus className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black text-sm uppercase outline-none focus:border-blue-600 mb-8" value={editName} onChange={e => setEditName(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={()=>setIsEditNameModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancel</button>
              <button onClick={commitNameChange} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* INTERNAL TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-3xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
              <div className="px-10 py-8 border-b bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-5"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><ArrowRightLeft size={28}/></div><div><h2 className="text-xl font-black uppercase tracking-tight leading-none">Internal fund transfer</h2><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5">Intra-Treasury Movement</p></div></div>
                 <button onClick={() => setIsTransferModalOpen(false)} className="text-4xl text-slate-400 hover:text-white transition-all">&times;</button>
              </div>
              <div className="p-10 space-y-8 bg-white overflow-y-auto max-h-[80vh] custom-scrollbar">
                <div className="grid grid-cols-2 gap-6 items-center">
                   <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4 text-left">Source (From)</label><select className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black text-xs uppercase" value={transferData.fromId} onChange={e=>setTransferData({...transferData, fromId: e.target.value})}><option value="">Select Account...</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                   <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-4 text-left">Destination (To)</label><select className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black text-xs uppercase" value={transferData.toId} onChange={e=>setTransferData({...transferData, toId: e.target.value})}><option value="">Select Account...</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                </div>
                <div className="space-y-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block text-left">Transfer Amount</label>
                   <div className="relative">
                      <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={32}/>
                      <input type="number" className="w-full pl-16 pr-8 py-8 bg-slate-950 text-white rounded-[2.5rem] font-black text-5xl tracking-tighter outline-none" placeholder="0.00" value={transferData.amount || ''} onChange={e=>setTransferData({...transferData, amount: parseFloat(e.target.value) || 0})} />
                   </div>
                </div>
                
                {(transferData.fromId === 'treasury-cash' || transferData.toId === 'treasury-cash') && (
                  <div className="p-8 bg-slate-50 border border-slate-200 rounded-[2.5rem] space-y-6">
                    <div className="flex justify-between items-center"><h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Coins size={14}/> Physical Notes moving</h3><div className={`px-4 py-1.5 rounded-lg font-black text-xs ${transferDenomTotal === transferData.amount ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>Σ {transferDenomTotal.toLocaleString()}</div></div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                       {Object.entries(transferDenoms).sort((a,b)=>Number(b[0])-Number(a[0])).map(([note, qty]) => (
                         <div key={note} className="space-y-1 text-center">
                            <label className="text-[9px] font-black text-slate-400">{note}</label>
                            <input type="number" className="w-full bg-white border border-slate-200 py-2 rounded-xl text-center font-black text-sm outline-none focus:border-blue-600" value={qty || ''} onChange={e=>setTransferDenoms({...transferDenoms, [Number(note)]: Math.max(0, parseInt(e.target.value)||0)})} />
                         </div>
                       ))}
                    </div>
                  </div>
                )}
                
                <input className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black text-xs uppercase outline-none" placeholder="Narration (Optional)..." value={transferData.description} onChange={e=>setTransferData({...transferData, description: e.target.value})} />
                <button onClick={handleInternalTransfer} disabled={transferData.amount <= 0 || ((transferData.fromId==='treasury-cash'||transferData.toId==='treasury-cash') && transferDenomTotal !== transferData.amount)} className="w-full py-6 bg-blue-600 text-white font-black rounded-full uppercase tracking-widest text-[11px] shadow-2xl hover:bg-blue-700 transform transition-all flex items-center justify-center gap-4 disabled:opacity-20">Commit Transfer <CircleCheckBig size={24}/></button>
              </div>
           </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {isAdjustmentModalOpen && selectedAccountId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="px-10 py-8 border-b bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-5"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Calculator size={28}/></div><div><h2 className="text-xl font-black uppercase tracking-tight leading-none">Initialize Balance</h2><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5">{state.parties.find(p=>p.id===selectedAccountId)?.name}</p></div></div>
                 <button onClick={() => setIsAdjustmentModalOpen(false)} className="text-4xl text-slate-400 hover:text-white transition-all">&times;</button>
              </div>
              <div className="p-10 space-y-10 bg-white">
                {selectedAccountId === 'treasury-cash' ? (
                   <div className="space-y-8">
                      <div className="flex items-center justify-between mb-2"><h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Coins size={16}/> Cash Denomination breakdown</h3><div className={`px-5 py-2 rounded-xl font-black text-sm ${denomTotal > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>Σ {denomTotal.toLocaleString()}</div></div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {(Object.entries(openingDenoms) as [string, number][]).sort((a,b) => Number(b[0]) - Number(a[0])).map(([note, qty]) => (
                          <div key={note} className="space-y-2 group">
                             <div className="flex justify-between items-center px-3 mb-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{note}</label></div>
                             <div className="flex bg-slate-50 border border-slate-200 rounded-2xl p-1 focus-within:border-blue-600 transition-all">
                                <button type="button" onClick={() => setOpeningDenoms(prev => ({...prev, [Number(note)]: Math.max(0, qty - 1)}))} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><Minus size={10}/></button>
                                <input type="number" className="w-full bg-transparent text-center font-black text-lg outline-none [appearance:textfield]" value={qty || ''} onChange={e => setOpeningDenoms(prev => ({...prev, [Number(note)]: Math.max(0, parseInt(e.target.value) || 0)}))} />
                                <button type="button" onClick={() => setOpeningDenoms(prev => ({...prev, [Number(note)]: qty + 1}))} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><Plus size={10}/></button>
                             </div>
                          </div>
                        ))}
                      </div>
                   </div>
                ) : (
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 block text-left">Set Opening Balance</label>
                      <div className="relative"><DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={32}/><input type="number" autoFocus className="w-full pl-16 pr-8 py-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] font-black text-5xl tracking-tighter outline-none focus:border-blue-600 shadow-inner" placeholder="0.00" value={newOpeningBal || ''} onChange={e => setNewOpeningBal(parseFloat(e.target.value) || 0)} /></div>
                   </div>
                )}
                <button onClick={commitOpeningBalance} className="w-full py-6 bg-slate-900 text-white font-black rounded-full uppercase tracking-widest text-[11px] shadow-2xl hover:bg-blue-600 transform transition-all flex items-center justify-center gap-4">Commit Changes <CircleCheckBig size={24}/></button>
              </div>
           </div>
        </div>
      )}

      <PinModal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onSuccess={() => { setIsPinModalOpen(false); setIsAdjustmentModalOpen(true); }} correctPin={state.settings.securityPin} />
    </div>
  );
};

export default Treasury;
