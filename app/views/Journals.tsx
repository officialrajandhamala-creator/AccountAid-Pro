
import React, { useState, useMemo } from 'react';
import { AppState, JournalEntry, Party } from '../types';
import { 
  Plus, Search, Trash2, Edit2, BookOpen, 
  CircleCheckBig, ArrowRight, X, Calendar, 
  Calculator, History, User, Tag, Download, Info,
  ArrowRightLeft
} from 'lucide-react';
import { getCurrentDateStr, formatAppDate } from '../utils/dateUtils';
import { downloadCSV } from '../utils/exportUtils';
import PinModal from '../components/PinModal';

interface JournalsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeUser: any;
}

const Journals: React.FC<JournalsProps> = ({ state, setState, activeUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'edit', id: string } | null>(null);

  const [newJournal, setNewJournal] = useState<Partial<JournalEntry>>({
    debitPartyId: '',
    creditPartyId: '',
    amount: 0,
    description: '',
    date: getCurrentDateStr()
  });

  const filteredJournals = state.journals.filter(j => 
    j.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    state.parties.find(p => p.id === j.debitPartyId)?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    state.parties.find(p => p.id === j.creditPartyId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const exportData = filteredJournals.map(j => ({
      Date: j.date,
      Time: j.time,
      'Debit Account': state.parties.find(p => p.id === j.debitPartyId)?.name,
      'Credit Account': state.parties.find(p => p.id === j.creditPartyId)?.name,
      Amount: j.amount,
      Description: j.description,
      'Created By': j.createdBy
    }));
    downloadCSV(exportData, 'Manual_Journal_Registry');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJournal.debitPartyId || !newJournal.creditPartyId || !newJournal.amount) {
      return alert("Complete all mandatory fields.");
    }
    if (newJournal.debitPartyId === newJournal.creditPartyId) {
      return alert("Debit and Credit accounts must be different.");
    }

    const journalData: JournalEntry = {
      ...newJournal as JournalEntry,
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      createdBy: activeUser.name
    };

    setState(prev => {
      const updatedParties = prev.parties.map(p => {
        if (p.id === journalData.debitPartyId) {
          return { ...p, balance: p.balance + journalData.amount };
        }
        if (p.id === journalData.creditPartyId) {
          return { ...p, balance: p.balance - journalData.amount };
        }
        return p;
      });

      return {
        ...prev,
        parties: updatedParties,
        journals: [journalData, ...prev.journals]
      };
    });

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setNewJournal({
      debitPartyId: '',
      creditPartyId: '',
      amount: 0,
      description: '',
      date: getCurrentDateStr()
    });
  };

  const executeAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'delete') {
      setState(prev => {
        const j = prev.journals.find(x => x.id === pendingAction.id)!;
        // Reverse balances
        const updatedParties = prev.parties.map(p => {
          if (p.id === j.debitPartyId) return { ...p, balance: p.balance - j.amount };
          if (p.id === j.creditPartyId) return { ...p, balance: p.balance + j.amount };
          return p;
        });
        return { 
          ...prev, 
          parties: updatedParties,
          journals: prev.journals.filter(x => x.id !== pendingAction.id) 
        };
      });
    }
    setIsPinModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Journal Entry</h1>
          <p className="text-slate-500 font-bold uppercase text-[9px] mt-3 tracking-widest">Manual Accounting Adjustments</p>
        </div>
        <div className="flex gap-4">
          <button onClick={handleExport} className="bg-white border border-slate-200 text-slate-400 px-6 py-4 rounded-[2rem] font-black text-[10px] uppercase shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-all"><Download size={16}/> Export Ledger</button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-10 py-4 rounded-[2rem] font-black text-[10px] uppercase shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-3"><Plus size={18}/> Add Journal</button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border flex gap-4"><Search className="text-slate-400" size={24} /><input type="text" placeholder="Lookup journal IDs, accounts, or narrations..." className="bg-transparent outline-none font-black flex-1 text-base text-slate-700 uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>

      <div className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjustment Detail</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Debit (In)</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Credit (Out)</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredJournals.map(journal => (
              <tr key={journal.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <p className="font-black text-slate-900 text-sm uppercase leading-none mb-2">{journal.description}</p>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                    {formatAppDate(journal.date, state.settings.dateSystem)} • {journal.time} • {journal.createdBy}
                  </p>
                </td>
                <td className="px-8 py-6">
                  <span className="text-emerald-600 font-black text-[10px] uppercase tracking-tighter bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                    {state.parties.find(p => p.id === journal.debitPartyId)?.name}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <span className="text-red-600 font-black text-[10px] uppercase tracking-tighter bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                    {state.parties.find(p => p.id === journal.creditPartyId)?.name}
                  </span>
                </td>
                <td className="px-8 py-6 text-right font-black text-slate-900 text-lg tracking-tighter">
                  {state.settings.currency} {journal.amount.toLocaleString()}
                </td>
                <td className="px-8 py-6 text-center">
                   <button onClick={() => { setPendingAction({ type: 'delete', id: journal.id }); setIsPinModalOpen(true); }} className="p-3 text-slate-200 hover:text-red-500 transition-all hover:bg-red-50 rounded-2xl"><Trash2 size={20}/></button>
                </td>
              </tr>
            ))}
            {filteredJournals.length === 0 && (
              <tr>
                <td colSpan={5} className="py-24 text-center text-slate-300 uppercase font-black tracking-widest text-[9px]">
                   <BookOpen size={48} className="mx-auto mb-4 opacity-10"/> No journal entries recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PinModal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onSuccess={executeAction} correctPin={state.settings.securityPin} />

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="px-10 py-6 border-b bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><BookOpen size={28}/></div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tighter leading-none">Post Journal Entry</h2>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5">Manual Debit/Credit Balancing</p>
                    </div>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-4xl text-slate-400 hover:text-white transition-colors">&times;</button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-8 bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Debit Account (+)</label>
                       <select required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase" value={newJournal.debitPartyId} onChange={e => setNewJournal({...newJournal, debitPartyId: e.target.value})}>
                          <option value="">Select Account...</option>
                          {state.parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                       </select>
                    </div>
                    <div className="flex justify-center md:pt-6">
                       <ArrowRightLeft className="text-slate-300" size={24}/>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Credit Account (-)</label>
                       <select required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase" value={newJournal.creditPartyId} onChange={e => setNewJournal({...newJournal, creditPartyId: e.target.value})}>
                          <option value="">Select Account...</option>
                          {state.parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Adjustment Amount</label>
                    <div className="relative">
                       <Calculator className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                       <input type="number" required className="w-full pl-16 pr-6 py-5 bg-slate-950 text-white border rounded-[2rem] font-black text-2xl tracking-tighter outline-none focus:ring-4 focus:ring-indigo-900/20" value={newJournal.amount || ''} onChange={e => setNewJournal({...newJournal, amount: parseFloat(e.target.value) || 0})} placeholder="0.00" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Narration / Context</label>
                    <textarea required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs uppercase h-32 resize-none outline-none focus:border-indigo-600" placeholder="Describe the reason for this manual adjustment..." value={newJournal.description} onChange={e => setNewJournal({...newJournal, description: e.target.value})} />
                 </div>

                 <div className="pt-6 border-t flex items-center justify-between">
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impact Value</p>
                       <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{state.settings.currency} {(newJournal.amount || 0).toLocaleString()}</p>
                    </div>
                    <button type="submit" className="px-16 py-6 bg-slate-900 text-white font-black rounded-full uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 transition-all flex items-center gap-4">
                       Post Journal <CircleCheckBig size={24}/>
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Journals;
