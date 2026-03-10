
import React, { useMemo, useState } from 'react';
import { AppState, RepairStatus, Transaction } from '../types';
import { 
  TrendingUp, TrendingDown, Wallet, Banknote, 
  Building2, ListTodo, ArrowRight, Coins,
  Clock, Package, Wrench, X, Receipt, ArrowUpRight, ArrowDownRight,
  Landmark
} from 'lucide-react';
import { formatAppDate } from '../utils/dateUtils';

interface DashboardProps {
  state: AppState;
}

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const [drillDownType, setDrillDownType] = useState<'income' | 'expense' | null>(null);

  const stats = useMemo(() => {
    const vaultTotal = (Object.entries(state.cashVault) as [string, number][]).reduce((s, [v, q]) => s + (Number(v) * q), 0);
    const bankBal = state.parties.find(p => p.id === 'treasury-bank')?.balance || 0;
    const walletBal = state.parties.find(p => p.id === 'treasury-wallet')?.balance || 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxs = state.transactions.filter(t => t.date === todayStr && t.paymentMethod !== 'Credit');
    
    const incomeTxs = todayTxs.filter(t => ['receipt', 'income', 'sale'].includes(t.type));
    const expenseTxs = todayTxs.filter(t => ['payment', 'expense', 'purchase'].includes(t.type));

    const income = incomeTxs.reduce((s,t) => s + t.totalAmount, 0);
    const expense = expenseTxs.reduce((s,t) => s + t.totalAmount, 0);

    return {
      cashBal: vaultTotal, bankBal, walletBal,
      income, expense,
      incomeTxs, expenseTxs,
      activeRepairs: state.repairs.filter(r => r.status !== RepairStatus.DELIVERED).length,
      totalInventory: state.inventory.reduce((sum, item) => sum + item.quantity, 0)
    };
  }, [state]);

  const activeDrillTxs = drillDownType === 'income' ? stats.incomeTxs : stats.expenseTxs;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 min-h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Command Center</h1>
          <p className="text-slate-500 font-bold uppercase text-[9px] md:text-[10px] mt-2 md:mt-3 tracking-[0.2em]">Enterprise Flow Intelligence</p>
        </div>
        <div className="w-full md:w-auto bg-slate-900 text-white px-6 md:px-8 py-4 rounded-3xl md:rounded-[2rem] shadow-2xl flex items-center justify-between md:justify-start gap-6">
           <div className="text-left md:text-right">
             <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">Net Cash Impact Today</p>
             <p className={`text-lg md:text-xl font-black leading-none mt-1 ${stats.income - stats.expense >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
               {state.settings.currency} {(stats.income - stats.expense).toLocaleString()}
             </p>
           </div>
           <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center border border-white/10 flex-shrink-0"><Coins size={20} className="text-blue-400"/></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <TreasuryCard icon={<Banknote className="text-emerald-500"/>} label="Cash Vault" value={stats.cashBal} color="border-emerald-100" currency={state.settings.currency}/>
        <TreasuryCard icon={<Landmark className="text-indigo-500"/>} label="Bank Reserve" value={stats.bankBal} color="border-indigo-100" currency={state.settings.currency}/>
        <TreasuryCard icon={<Wallet className="text-purple-500"/>} label="Digital Assets" value={stats.walletBal} color="border-purple-100" currency={state.settings.currency}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={18}/> Inflow / Outflow Today</h2>
            <span className="text-[8px] font-black text-slate-300 uppercase italic">Excluding credit ledgers</span>
          </div>
          <div className="grid grid-cols-2 gap-6">
             <button onClick={() => setDrillDownType('income')} className="text-left bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100 group hover:bg-emerald-500 transition-all">
                <div className="flex justify-between items-start mb-2"><p className="text-[10px] font-black text-emerald-600 group-hover:text-emerald-100 uppercase tracking-widest">Inflow</p><ArrowUpRight className="text-emerald-400 group-hover:text-white" size={16}/></div>
                <p className="text-3xl font-black text-slate-900 group-hover:text-white leading-none">{state.settings.currency} {stats.income.toLocaleString()}</p>
             </button>
             <button onClick={() => setDrillDownType('expense')} className="text-left bg-red-50/50 p-8 rounded-[2.5rem] border border-red-100 group hover:bg-red-500 transition-all">
                <div className="flex justify-between items-start mb-2"><p className="text-[10px] font-black text-red-600 group-hover:text-red-100 uppercase tracking-widest">Outflow</p><ArrowDownRight className="text-red-400 group-hover:text-white" size={16}/></div>
                <p className="text-3xl font-black text-slate-900 group-hover:text-white leading-none">{state.settings.currency} {stats.expense.toLocaleString()}</p>
             </button>
          </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
          <Coins className="absolute -right-12 -bottom-12 text-white/5 transition-transform duration-700" size={300}/>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6">Operations Overview</h2>
            <div className="grid grid-cols-2 gap-10">
               <div className="space-y-2">
                 <p className="text-5xl font-black tracking-tighter text-blue-400">{stats.activeRepairs}</p>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Repair Jobs</p>
               </div>
               <div className="space-y-2">
                 <p className="text-5xl font-black tracking-tighter text-indigo-400">{stats.totalInventory}</p>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stock Units</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-sm border">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Coins size={18}/> Vault Denomination Master</h2>
          <div className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> Live Registry</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-4">
           {(Object.entries(state.cashVault) as [string, number][]).sort((a,b) => Number(b[0]) - Number(a[0])).map(([note, qty]) => (
             <div key={note} className={`p-5 rounded-3xl border text-center transition-all shadow-sm group ${qty > 0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${qty > 0 ? 'text-blue-100' : 'text-slate-400'}`}>{note}</p>
                <p className="text-2xl font-black leading-none">{qty}</p>
             </div>
           ))}
        </div>
      </div>

      {drillDownType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in duration-200">
              <div className={`p-8 border-b text-white flex justify-between items-center ${drillDownType === 'income' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                 <div className="flex items-center gap-4">
                    <Receipt size={24}/>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight">Today's {drillDownType === 'income' ? 'Inflows' : 'Outflows'}</h2>
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Digital Registry</p>
                    </div>
                 </div>
                 <button onClick={() => setDrillDownType(null)} className="p-2 hover:bg-black/10 rounded-xl"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                 {activeDrillTxs.map(tx => (
                    <div key={tx.id} className="p-6 bg-slate-50 border rounded-2xl flex justify-between items-center hover:bg-white hover:shadow-md transition-all">
                       <div>
                          <p className="font-black text-slate-900 uppercase text-xs tracking-tight">{tx.description}</p>
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">{tx.time} • {tx.paymentMethod} • {tx.partyId ? state.parties.find(p => p.id === tx.partyId)?.name : 'Direct Entry'}</p>
                       </div>
                       <div className="text-right"><p className={`text-lg font-black ${drillDownType === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{state.settings.currency} {tx.totalAmount.toLocaleString()}</p></div>
                    </div>
                 ))}
                 {activeDrillTxs.length === 0 && <div className="py-20 text-center"><p className="text-slate-300 font-black uppercase text-xs tracking-widest">No entries recorded for this category today.</p></div>}
              </div>
              <div className="p-8 border-t bg-slate-50 flex justify-between items-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Net</p>
                 <p className="text-2xl font-black text-slate-900">{state.settings.currency} {(drillDownType === 'income' ? stats.income : stats.expense).toLocaleString()}</p>
              </div>
           </div>
        </div>
      )}

      <footer className="mt-auto py-8 text-center text-slate-400 text-[9px] font-black uppercase tracking-[0.4em]">
        Powered by Rajan Dhamala and Associate
      </footer>
    </div>
  );
};

const TreasuryCard: React.FC<{ icon: React.ReactNode, label: string, value: number, color: string, currency: string }> = ({ icon, label, value, color, currency }) => (
  <div className={`bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-sm border-b-8 ${color} hover:shadow-2xl transition-all group`}>
    <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-50 flex items-center justify-center mb-6 md:mb-8 shadow-inner group-hover:scale-110 transition-transform">{icon}</div>
    <p className="text-slate-400 font-black text-[9px] md:text-[10px] uppercase tracking-widest mb-1 md:mb-2">{label}</p>
    <p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-none">{currency} {value.toLocaleString()}</p>
  </div>
);

export default Dashboard;
