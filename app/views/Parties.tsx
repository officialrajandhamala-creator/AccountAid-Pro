import React, { useState, useMemo } from 'react';
import { AppState, Party, Transaction, SuperAdminSession } from '../types';
import { formatAppDate } from '../utils/dateUtils';
import { downloadCSV } from '../utils/exportUtils';
import PinModal from '../components/PinModal';
import { Edit2, Trash2, Calculator } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const CASH_ACCOUNT_ID = 'treasury-cash';

// Systematic Account Groups
const ACCOUNT_GROUPS = [
  "BANK ACCOUNTS", "CASH-IN-HAND", "SUNDRY DEBTORS", "SUNDRY CREDITORS", 
  "EXPENSES (Indirect)", "FIXED ASSETS", "DUTIES & TAXES", "CAPITAL ACCOUNT"
];

const groupToTypeMap: Record<string, Party['type']> = {
  "BANK ACCOUNTS": 'treasury',
  "CASH-IN-HAND": 'treasury',
  "SUNDRY DEBTORS": 'customer',
  "SUNDRY CREDITORS": 'supplier',
  "EXPENSES (Indirect)": 'expense',
  "FIXED ASSETS": 'fixed_asset',
  "DUTIES & TAXES": 'liability',
  "CAPITAL ACCOUNT": 'equity'
};

const typeToGroupMap: Record<Party['type'], string> = {
  'treasury': "BANK ACCOUNTS",
  'customer': "SUNDRY DEBTORS",
  'supplier': "SUNDRY CREDITORS",
  'expense': "EXPENSES (Indirect)",
  'fixed_asset': "FIXED ASSETS",
  'liability': "DUTIES & TAXES",
  'equity': "CAPITAL ACCOUNT",
  'income': "INCOME (Indirect)"
};

interface PartiesProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeUser: any;
  superAdminSession: SuperAdminSession | null;
}

const PartiesView: React.FC<PartiesProps> = ({ state, setState, activeUser, superAdminSession }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isCashBalanceModalOpen, setIsCashBalanceModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'edit' | 'cash-adjust', id: string } | null>(null);
  const [cashAdjustmentVal, setCashAdjustmentVal] = useState(0);

  const isAdmin = activeUser?.role === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    group: '',
    pan: '',
    openingBal: '',
    address: '',
    phone: '',
    email: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCashAdjustment = () => {
    setState(prev => ({
      ...prev,
      parties: prev.parties.map(p => p.id === CASH_ACCOUNT_ID ? { ...p, balance: cashAdjustmentVal } : p)
    }));
    setIsCashBalanceModalOpen(false);
    setPendingAction(null);
  };

  const executeAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'delete') {
      setState(prev => ({ ...prev, parties: prev.parties.filter(p => p.id !== pendingAction.id) }));
    } else if (pendingAction.type === 'edit') {
      const party = state.parties.find(p => p.id === pendingAction.id);
      if (party) { 
        setFormData({
          name: party.name,
          group: typeToGroupMap[party.type] || '',
          pan: party.panNumber || '',
          openingBal: party.balance.toString(),
          address: party.address || '',
          phone: party.phone || '',
          email: ''
        });
        setShowCreate(true); 
      }
    } else if (pendingAction.type === 'cash-adjust') {
      const cashAc = state.parties.find(p => p.id === CASH_ACCOUNT_ID);
      setCashAdjustmentVal(cashAc?.balance || 0);
      setIsCashBalanceModalOpen(true);
    }
    setIsPinModalOpen(false);
  };

  const triggerAction = (type: 'delete' | 'edit' | 'cash-adjust', id: string) => {
    setPendingAction({ type, id });
    if (superAdminSession) {
      if (type === 'delete') {
        setState(prev => ({ ...prev, parties: prev.parties.filter(p => p.id !== id) }));
      } else if (type === 'edit') {
        const party = state.parties.find(p => p.id === id);
        if (party) { 
          setFormData({
            name: party.name,
            group: typeToGroupMap[party.type] || '',
            pan: party.panNumber || '',
            openingBal: party.balance.toString(),
            address: party.address || '',
            phone: party.phone || '',
            email: ''
          });
          setShowCreate(true); 
        }
      } else if (type === 'cash-adjust') {
        const cashAc = state.parties.find(p => p.id === CASH_ACCOUNT_ID);
        setCashAdjustmentVal(cashAc?.balance || 0);
        setIsCashBalanceModalOpen(true);
      }
    } else {
      setIsPinModalOpen(true);
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.group) {
      alert("Name and Group are required");
      return;
    }

    setState(prev => {
      let currentParties = [...prev.parties];
      if (pendingAction?.type === 'edit') {
        currentParties = currentParties.map(p => {
          if (p.id === pendingAction.id) {
            return {
              ...p,
              name: formData.name,
              type: groupToTypeMap[formData.group] || 'customer',
              phone: formData.phone,
              address: formData.address,
              panNumber: formData.pan
            };
          }
          return p;
        });
      } else {
        const newParty: Party = {
          id: crypto.randomUUID(),
          name: formData.name,
          type: groupToTypeMap[formData.group] || 'customer',
          phone: formData.phone,
          address: formData.address,
          panNumber: formData.pan,
          balance: parseFloat(formData.openingBal) || 0,
          createdBy: activeUser.name
        };
        currentParties.push(newParty);
      }
      return { ...prev, parties: currentParties };
    });

    setFormData({
      name: '',
      group: '',
      pan: '',
      openingBal: '',
      address: '',
      phone: '',
      email: ''
    });
    setShowCreate(false);
    setPendingAction(null);
  };

  const selectedParty = useMemo(() => state.parties.find(p => p.id === selectedPartyId), [selectedPartyId, state.parties]);

  const ledgerData = useMemo(() => {
    if (!selectedParty) return { openingBalance: 0, entries: [], closingBalance: 0 };
    
    const partyTxs = state.transactions.filter(tx => 
      tx.partyId === selectedParty.id || 
      (selectedParty.type === 'treasury' && tx.paymentMethod === selectedParty.id) ||
      (tx.type === 'transfer' && (tx.fromPartyId === selectedParty.id || tx.toPartyId === selectedParty.id))
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let totalImpact = 0;
    partyTxs.forEach(tx => {
      const isTreasury = selectedParty.type === 'treasury';
      if (tx.type === 'transfer') {
         if (tx.fromPartyId === selectedParty.id) totalImpact -= tx.totalAmount;
         if (tx.toPartyId === selectedParty.id) totalImpact += tx.totalAmount;
      } else if (isTreasury) {
         if (['sale', 'income', 'receipt', 'purchase_return'].includes(tx.type)) totalImpact += tx.totalAmount;
         else totalImpact -= tx.totalAmount;
      } else {
         if (tx.type === 'sale') {
            if (tx.paymentMethod === 'Credit') totalImpact += tx.totalAmount;
         } else if (tx.type === 'purchase') {
            if (tx.paymentMethod === 'Credit') totalImpact -= tx.totalAmount;
         } else if (tx.type === 'sale_return') {
            if (tx.paymentMethod === 'Credit') totalImpact -= tx.totalAmount;
         } else if (tx.type === 'purchase_return') {
            if (tx.paymentMethod === 'Credit') totalImpact += tx.totalAmount;
         } else if (tx.type === 'receipt') {
            totalImpact -= tx.totalAmount;
         } else if (tx.type === 'payment') {
            totalImpact += tx.totalAmount;
         } else if (tx.type === 'income') {
            totalImpact -= tx.totalAmount;
         } else if (tx.type === 'expense') {
            totalImpact += tx.totalAmount;
         }
      }
    });

    const openingBalance = selectedParty.balance - totalImpact;
    let currentBal = openingBalance;
    const entries = partyTxs.map(tx => {
      let dr = 0, cr = 0;
      const isTreasury = selectedParty.type === 'treasury';
      if (tx.type === 'transfer') {
         if (tx.fromPartyId === selectedParty.id) cr = tx.totalAmount;
         if (tx.toPartyId === selectedParty.id) dr = tx.totalAmount;
      } else if (isTreasury) {
         if (['sale', 'income', 'receipt', 'purchase_return'].includes(tx.type)) dr = tx.totalAmount;
         else cr = tx.totalAmount;
      } else {
         if (tx.type === 'sale') {
            if (tx.paymentMethod === 'Credit') dr = tx.totalAmount;
         } else if (tx.type === 'purchase') {
            if (tx.paymentMethod === 'Credit') cr = tx.totalAmount;
         } else if (tx.type === 'sale_return') {
            if (tx.paymentMethod === 'Credit') cr = tx.totalAmount;
         } else if (tx.type === 'purchase_return') {
            if (tx.paymentMethod === 'Credit') dr = tx.totalAmount;
         } else if (tx.type === 'receipt') {
            cr = tx.totalAmount;
         } else if (tx.type === 'payment') {
            dr = tx.totalAmount;
         } else if (tx.type === 'income') {
            cr = tx.totalAmount;
         } else if (tx.type === 'expense') {
            dr = tx.totalAmount;
         }
      }
      currentBal += (dr - cr);
      return { ...tx, debit: dr, credit: cr, runningBalance: currentBal };
    });
    return { openingBalance, entries, closingBalance: selectedParty.balance };
  }, [selectedParty, state.transactions]);

  const exportToExcel = () => {
    if(!selectedParty) return alert("Select a party first!");
    const exportData = ledgerData.entries.map(e => ({
      Date: formatAppDate(e.date, state.settings.dateSystem),
      'Bill No': e.billNumber || e.id.substring(0, 8),
      Description: e.description,
      'Debit (Dr)': e.debit,
      'Credit (Cr)': e.credit,
      Balance: e.runningBalance
    }));
    downloadCSV(exportData, `${selectedParty.name}_Ledger`);
  };

  const printPDF = async () => {
    if(!selectedParty) return alert("Select a party first!");
    const printerType = state.settings.printerType;
    if (!printerType) {
      alert("Printer Configuration Missing: Please set up a default printer in the Settings module before printing.");
      return;
    }
    if (printerType === 'pdf') {
      try {
        const element = document.getElementById('printable-area') as HTMLElement;
        if (!element) return;
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const opt = {
          margin:       0.5,
          filename:     `Ledger_${selectedParty?.name}_${dateStr}.pdf`,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
        };
        html2pdf().set(opt).from(element).save();
      } catch (error) {
        console.error("PDF Generation failed", error);
        alert("Failed to generate PDF. Please check console for details.");
      }
    } else {
      window.print();
    }
  };

  return (
    <div className="parties-container" style={{ padding: '20px', background: '#f4f7f6', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media print {
          .parties-container { height: auto; overflow: visible; background: white; padding: 0; }
          .no-print { display: none !important; }
          #printable-area { border: none !important; padding: 0 !important; overflow: visible !important; }
        }
      `}</style>

      <PinModal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onSuccess={executeAction} correctPin={state.settings.securityPin} />

      {isCashBalanceModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-xs rounded-[3rem] p-10 text-center shadow-2xl">
              <h3 className="text-lg font-black uppercase mb-2">Sync Vault Balance</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-8">Override physical cash on hand</p>
              <input type="number" className="w-full text-center text-4xl font-black py-4 bg-slate-50 rounded-2xl mb-8 outline-none border-2 border-slate-100 focus:border-blue-400" value={cashAdjustmentVal} onChange={e => setCashAdjustmentVal(parseFloat(e.target.value) || 0)} />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setIsCashBalanceModalOpen(false)} className="py-4 font-black text-slate-400 uppercase text-[10px]">Cancel</button>
                <button onClick={handleCashAdjustment} className="py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] shadow-lg">Commit Sync</button>
              </div>
           </div>
        </div>
      )}

      {/* Header with Global Actions */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', flexShrink: 0 }}>
        <div>
          <h2 style={{ color: '#002d5a', margin: 0 }}>Systematic Ledger Master</h2>
          <span style={{ fontSize: '12px', color: '#666' }}>Manage Cash, Bank, Debtors & Creditors</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={exportToExcel} style={btnSecondary}>Excel Export</button>
          <button onClick={printPDF} style={btnSecondary}>Print PDF</button>
          <button onClick={() => {
            if (!showCreate) {
              setFormData({ name: '', group: '', pan: '', openingBal: '', address: '', phone: '', email: '' });
              setPendingAction(null);
            }
            setShowCreate(!showCreate);
          }} style={btnPrimary}>
            {showCreate ? 'Close' : '+ New Ledger'}
          </button>
        </div>
      </div>

      {/* Compact Creation Form */}
      {showCreate && (
        <div className="no-print" style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', flexShrink: 0 }}>
          <input name="name" value={formData.name} onChange={handleChange} placeholder="Account Name *" style={miniInput} />
          <select name="group" value={formData.group} onChange={handleChange} style={miniInput}>
            <option value="">-- Select Group * --</option>
            {ACCOUNT_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <input name="pan" value={formData.pan} onChange={handleChange} placeholder="PAN Number" style={miniInput} />
          <input name="openingBal" type="number" disabled={pendingAction?.type === 'edit'} value={formData.openingBal} onChange={handleChange} placeholder="Opening Balance" style={{...miniInput, opacity: pendingAction?.type === 'edit' ? 0.5 : 1}} />
          <input name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone" style={miniInput} />
          <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" style={miniInput} />
          <input name="address" value={formData.address} onChange={handleChange} placeholder="Address" style={{ ...miniInput, gridColumn: 'span 2' }} />
          <button onClick={handleSave} style={{ ...btnPrimary, background: '#27ae60', gridColumn: 'span 4' }}>
            {pendingAction?.type === 'edit' ? 'Update Ledger' : 'Create Ledger'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', flex: 1, minHeight: 0 }}>
        
        {/* Left: Ledger Accounts List */}
        <div className="no-print" style={{ background: 'white', borderRadius: '8px', border: '1px solid #ddd', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px', background: '#f8f9fa', fontWeight: 'bold', borderBottom: '1px solid #ddd', position: 'sticky', top: 0 }}>Account List</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {state.parties.map(p => (
              <div key={p.id} style={{ 
                padding: '12px', borderBottom: '1px solid #eee', cursor: 'pointer',
                background: selectedPartyId === p.id ? '#eef6ff' : 'white',
                borderLeft: selectedPartyId === p.id ? '4px solid #002d5a' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div onClick={() => setSelectedPartyId(p.id)} style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{typeToGroupMap[p.type] || p.type}</div>
                </div>
                {isAdmin && !p.isSystemAccount && (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={(e) => { e.stopPropagation(); triggerAction('edit', p.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0056b3' }}><Edit2 size={14}/></button>
                    <button onClick={(e) => { e.stopPropagation(); triggerAction('delete', p.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545' }}><Trash2 size={14}/></button>
                  </div>
                )}
                {isAdmin && p.id === CASH_ACCOUNT_ID && (
                  <button onClick={(e) => { e.stopPropagation(); triggerAction('cash-adjust', p.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f39c12' }}><Calculator size={14}/></button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detailed Ledger Statement */}
        <div id="printable-area" style={{ background: 'white', borderRadius: '8px', border: '1px solid #ddd', padding: '20px', overflowY: 'auto' }}>
          {selectedParty ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>{state.settings.companyName || 'Company Name'}</h3>
                <p style={{ margin: 5 }}>Ledger Statement: <b>{selectedParty.name}</b></p>
                <small>{state.settings.companyAddress || 'Company Address'} | PAN: {state.settings.companyPan || 'N/A'}</small>
                <br/>
                <small style={{ color: '#666' }}>Party Details: {selectedParty.address || 'N/A'} | PAN: {selectedParty.panNumber || 'N/A'} | Phone: {selectedParty.phone || 'N/A'}</small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f1f1f1', borderRadius: '5px', marginBottom: '10px' }}>
                <span>Opening Balance: <b>{Math.abs(ledgerData.openingBalance).toLocaleString()} {ledgerData.openingBalance >= 0 ? 'Dr' : 'Cr'}</b></span>
                <span>Closing Balance: <b style={{ color: '#002d5a' }}>{Math.abs(ledgerData.closingBalance).toLocaleString()} {ledgerData.closingBalance >= 0 ? 'Dr' : 'Cr'}</b></span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#002d5a', color: 'white' }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Bill/Ref No</th>
                    <th style={thStyle}>Description</th>
                    <th style={thSide}>Debit (Dr)</th>
                    <th style={thSide}>Credit (Cr)</th>
                    <th style={thSide}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.entries.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={tdStyle}>{formatAppDate(t.date, state.settings.dateSystem)}</td>
                      <td style={tdStyle}><span style={{ color: '#0056b3', cursor: 'pointer' }}>{t.billNumber || t.id.substring(0, 8)}</span></td>
                      <td style={tdStyle}>{t.description}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'green' }}>{t.debit > 0 ? t.debit.toLocaleString() : '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: 'red' }}>{t.credit > 0 ? t.credit.toLocaleString() : '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{Math.abs(t.runningBalance).toLocaleString()} {t.runningBalance >= 0 ? 'Dr' : 'Cr'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '100px', color: '#bbb' }}>Select an account to view Transactions</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Styles
const miniInput = { padding: '10px', border: '1px solid #ccc', borderRadius: '4px' };
const btnPrimary = { background: '#002d5a', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const btnSecondary = { background: '#fff', color: '#333', padding: '10px 15px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' };
const thStyle = { padding: '12px', textAlign: 'left' as 'left' };
const thSide = { padding: '12px', textAlign: 'right' as 'right' };
const tdStyle = { padding: '12px' };

export default PartiesView;
