
import React, { useState, useMemo } from 'react';
import { AppState, Repair, RepairStatus, InventoryItem, PaymentMethod, Party, Transaction, RepairPart, SuperAdminSession } from '../types';
import { 
  Plus, Search, Smartphone, Trash2, Edit2, Download, 
  CircleCheckBig, ChevronRight, Calculator, UserCheck, Lock, 
  History, ShieldCheck, Receipt, X, Printer, UserPlus, Clock,
  Package, Box, Wrench, Settings, ArrowRight, Tag
} from 'lucide-react';
import { getCurrentDateStr, formatAppDate } from '../utils/dateUtils';
import { downloadCSV } from '../utils/exportUtils';
import PinModal from '../components/PinModal';

interface RepairsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeUser: any;
  superAdminSession: SuperAdminSession | null;
}

const Repairs: React.FC<RepairsProps> = ({ state, setState, activeUser, superAdminSession }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportRepairId, setReportRepairId] = useState<string | null>(null);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isPartsPickerOpen, setIsPartsPickerOpen] = useState(false);
  const [isIMEIPickerOpen, setIsIMEIPickerOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  
  const [pendingAction, setPendingAction] = useState<{ type: 'status' | 'delete' | 'edit', id: string, nextStatus?: RepairStatus } | null>(null);
  const [deliveryStaffName, setDeliveryStaffName] = useState('');
  const [partSearch, setPartSearch] = useState('');
  const [activePartItemId, setActivePartItemId] = useState<string | null>(null);

  const [newRepair, setNewRepair] = useState<Partial<Repair>>({ 
    customerName: '', customerPhone: '', model: '', imei: '', issue: '', 
    technician: activeUser.name, estimatedCost: 0, status: RepairStatus.RECEIVED, 
    usedParts: [], paymentMethod: 'Credit', receivedDate: getCurrentDateStr()
  });

  const filteredRepairs = state.repairs.filter(repair => 
    repair.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    repair.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
    repair.imei.includes(searchTerm)
  );

  const statusOrder = [
    RepairStatus.RECEIVED, RepairStatus.DIAGNOSING, RepairStatus.REPAIRING, RepairStatus.COMPLETED, RepairStatus.DELIVERED
  ];

  const handleExport = () => {
    downloadCSV(filteredRepairs, 'Service_Desk_Master');
  };

  const addPartToRepair = (item: InventoryItem) => {
    if (newRepair.usedParts?.some(p => p.itemId === item.id)) return alert("Item already added to parts list.");
    
    const part: RepairPart = {
      itemId: item.id,
      name: item.name,
      quantity: 1,
      cost: item.salePrice,
      isIMEIBased: item.isIMEIBased,
      selectedImeis: []
    };

    setNewRepair(prev => ({
      ...prev,
      usedParts: [...(prev.usedParts || []), part],
      estimatedCost: prev.estimatedCost === 0 ? item.salePrice : prev.estimatedCost
    }));
    
    if (item.isIMEIBased) {
      setActivePartItemId(item.id);
      setIsIMEIPickerOpen(true);
    }
    setPartSearch('');
    setIsPartsPickerOpen(false);
  };

  const toggleImeiForPart = (itemId: string, imei: string) => {
    setNewRepair(prev => {
      const updatedParts = prev.usedParts?.map(p => {
        if (p.itemId === itemId) {
          const alreadySelected = p.selectedImeis?.includes(imei);
          const newImeis = alreadySelected 
            ? p.selectedImeis!.filter(i => i !== imei) 
            : [...(p.selectedImeis || []), imei];
          return { ...p, selectedImeis: newImeis, quantity: newImeis.length || 1 };
        }
        return p;
      });
      return { ...prev, usedParts: updatedParts };
    });
  };

  const handleCreateRepair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepair.customerName || !newRepair.model || !newRepair.imei) return alert("Customer, Model, and IMEI are mandatory.");

    setState(prev => {
      let updatedRepairs = [...prev.repairs];
      if (pendingAction?.type === 'edit') {
        updatedRepairs = updatedRepairs.map(r => r.id === pendingAction.id ? { ...r, ...newRepair as Repair, id: pendingAction.id } : r);
      } else {
        const repairData = {
          ...newRepair,
          id: crypto.randomUUID(),
          createdBy: activeUser.name,
          receivedBy: activeUser.name
        } as Repair;
        updatedRepairs = [repairData, ...updatedRepairs];
      }
      return { ...prev, repairs: updatedRepairs };
    });

    setIsModalOpen(false);
    resetForm();
    setPendingAction(null);
  };

  const executePinAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'delete') {
      setState(prev => ({ ...prev, repairs: prev.repairs.filter(r => r.id !== pendingAction.id) }));
    } else if (pendingAction.type === 'edit') {
      const repair = state.repairs.find(r => r.id === pendingAction.id);
      if (repair) {
        setNewRepair(repair);
        setIsModalOpen(true);
      }
    }
    setIsPinModalOpen(false);
  };

  const triggerAction = (type: 'delete' | 'edit', id: string) => {
    setPendingAction({ type, id });
    if (superAdminSession) {
      if (type === 'delete') {
        setState(prev => ({ ...prev, repairs: prev.repairs.filter(r => r.id !== id) }));
      } else {
        const repair = state.repairs.find(r => r.id === id);
        if (repair) {
          setNewRepair(repair);
          setIsModalOpen(true);
        }
      }
    } else {
      setIsPinModalOpen(true);
    }
  };

  const finalizeStatusUpdate = () => {
    const repairId = pendingAction?.id;
    const nextStatus = pendingAction?.nextStatus;
    if (!repairId || !nextStatus) return;

    setState(prev => {
      const targetRepair = prev.repairs.find(r => r.id === repairId)!;
      
      const updatedRepairs = prev.repairs.map(r => {
        if (r.id === repairId) {
          return { 
            ...r, 
            status: nextStatus, 
            deliveredBy: nextStatus === RepairStatus.DELIVERED ? deliveryStaffName : r.deliveredBy,
            deliveryDate: nextStatus === RepairStatus.DELIVERED ? new Date().toISOString() : r.deliveryDate
          };
        }
        return r;
      });

      let nextState = { ...prev, repairs: updatedRepairs };

      if (nextStatus === RepairStatus.DELIVERED) {
         nextState.inventory = nextState.inventory.map(inv => {
            const usedPart = targetRepair.usedParts.find(p => p.itemId === inv.id);
            if (!usedPart) return inv;

            let newImeis = [...inv.imeis];
            if (inv.isIMEIBased && usedPart.selectedImeis) {
              newImeis = newImeis.filter(i => !usedPart.selectedImeis!.includes(i));
            }

            return {
              ...inv,
              quantity: inv.quantity - usedPart.quantity,
              imeis: newImeis
            };
         });

         let party = nextState.parties.find(p => p.name.trim().toLowerCase() === targetRepair.customerName.trim().toLowerCase());
         if (!party) {
            party = { id: crypto.randomUUID(), name: targetRepair.customerName, phone: targetRepair.customerPhone, type: 'customer', balance: 0, createdBy: activeUser.name };
            nextState.parties = [...nextState.parties, party];
         }
         
         const newTx: Transaction = {
            id: crypto.randomUUID(), date: getCurrentDateStr(), time: new Date().toLocaleTimeString(),
            partyId: party.id, locationId: 'default', type: 'sale', paymentMethod: 'Credit',
            totalAmount: targetRepair.estimatedCost, description: `Repair Delivery: ${targetRepair.model} (${targetRepair.imei})`,
            createdBy: activeUser.name
         };
         nextState.transactions = [newTx, ...nextState.transactions];
         nextState.parties = nextState.parties.map(p => p.id === party!.id ? { ...p, balance: p.balance + targetRepair.estimatedCost } : p);
      }

      return nextState;
    });

    setPendingAction(null);
    setIsDeliveryModalOpen(false);
    setDeliveryStaffName('');
  };

  const handleNextStage = (repairId: string, currentStatus: RepairStatus) => {
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) return;
    
    const nextStatus = statusOrder[currentIndex + 1];
    if (nextStatus === RepairStatus.DELIVERED) {
      setPendingAction({ type: 'status', id: repairId, nextStatus });
      setIsDeliveryModalOpen(true);
    } else {
      setState(prev => ({ ...prev, repairs: prev.repairs.map(r => r.id === repairId ? { ...r, status: nextStatus } : r) }));
    }
  };

  const resetForm = () => {
    setNewRepair({ 
      customerName: '', customerPhone: '', model: '', imei: '', issue: '', 
      technician: activeUser.name, estimatedCost: 0, status: RepairStatus.RECEIVED, 
      usedParts: [], paymentMethod: 'Credit', receivedDate: getCurrentDateStr()
    });
    setPendingAction(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Service Desk</h1>
          <p className="text-slate-500 font-bold uppercase text-[8px] md:text-[9px] mt-2 tracking-widest">Job Lifecycle & Serialized Parts</p>
        </div>
        <div className="flex gap-2 md:gap-3 w-full sm:w-auto">
          <button onClick={handleExport} className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-600 px-4 md:px-6 py-3 rounded-2xl font-black text-[9px] md:text-[10px] uppercase shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><Download size={16}/> Export History</button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-indigo-600 text-white px-6 md:px-8 py-3 rounded-2xl font-black text-[9px] md:text-[10px] uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-indigo-500/20"><Plus size={16}/> New Repair Job</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border flex gap-4"><Search className="text-slate-400" size={20} /><input type="text" placeholder="Lookup model, customer name, or device IMEI..." className="bg-transparent outline-none font-bold flex-1 text-sm text-slate-800 uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>

      <div className="bg-white rounded-[3rem] shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Device Identity</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lifecycle Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estimate</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRepairs.map(repair => (
                <tr key={repair.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${repair.status === RepairStatus.DELIVERED ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}><Smartphone size={24} /></div>
                      <div>
                        <p className="font-black text-slate-900 text-base uppercase tracking-tight leading-none group-hover:text-indigo-600 transition-colors">{repair.model}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">S/N: {repair.imei} • {repair.customerName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase border-2 ${repair.status === RepairStatus.DELIVERED ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-indigo-600 border-indigo-100'}`}>{repair.status}</span>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-slate-900 tracking-tighter text-lg">{state.settings.currency} {repair.estimatedCost.toLocaleString()}</td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                       {repair.status !== RepairStatus.DELIVERED && (
                        <button onClick={() => handleNextStage(repair.id, repair.status)} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:scale-105 transition-all"><ChevronRight size={18}/></button>
                       )}
                       <button onClick={() => setReportRepairId(repair.id)} className="p-3 text-slate-300 hover:text-indigo-600 transition-all hover:bg-indigo-50 rounded-xl"><Receipt size={18}/></button>
                       <button onClick={() => triggerAction('edit', repair.id)} className="p-3 text-slate-300 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-xl"><Edit2 size={18}/></button>
                       <button onClick={() => triggerAction('delete', repair.id)} className="p-3 text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-xl"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PinModal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onSuccess={executePinAction} correctPin={state.settings.securityPin} />

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-6xl h-[94vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 border border-white/20">
              <div className="px-10 py-6 border-b bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30"><Wrench size={28}/></div>
                    <div>
                       <h2 className="text-xl font-black uppercase tracking-tight leading-none">{pendingAction?.type === 'edit' ? 'Update Job' : 'Job Workbench'}</h2>
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5">Operator: {activeUser.name}</p>
                    </div>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-4xl text-slate-400 hover:text-white transition-all">&times;</button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                 <form onSubmit={handleCreateRepair} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 p-12 overflow-y-auto space-y-12 bg-white custom-scrollbar">
                       <div className="grid grid-cols-2 gap-10">
                          <div className="space-y-6">
                             <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserCheck size={16}/> Customer Identity</h3>
                             <div className="grid grid-cols-1 gap-4">
                                <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-black text-sm uppercase shadow-inner" placeholder="Client Full Name" value={newRepair.customerName} onChange={e => setNewRepair({...newRepair, customerName: e.target.value})} />
                                <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-black text-sm shadow-inner" placeholder="Contact Terminal No." value={newRepair.customerPhone} onChange={e => setNewRepair({...newRepair, customerPhone: e.target.value})} />
                             </div>
                          </div>
                          <div className="space-y-6">
                             <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Smartphone size={16}/> Asset Particulars</h3>
                             <div className="grid grid-cols-1 gap-4">
                                <input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-black text-sm uppercase shadow-inner" placeholder="Hardware Model (e.g. iPhone 15)" value={newRepair.model} onChange={e => setNewRepair({...newRepair, model: e.target.value})} />
                                <input required className="w-full px-6 py-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl outline-none font-mono font-black text-sm uppercase shadow-inner text-indigo-600" placeholder="Primary Serial / IMEI" value={newRepair.imei} onChange={e => setNewRepair({...newRepair, imei: e.target.value})} />
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                          <div className="md:col-span-2 space-y-6">
                             <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Settings size={16}/> Billable Components & Parts</h3>
                                <div className="relative">
                                   <button type="button" onClick={() => setIsPartsPickerOpen(true)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"><Plus size={14}/> Add Part From Stock</button>
                                   {isPartsPickerOpen && (
                                     <div className="absolute right-0 top-12 z-[100] w-80 bg-white border rounded-3xl shadow-2xl p-4 animate-in zoom-in duration-200">
                                        <div className="relative mb-4">
                                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                          <input autoFocus className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-2xl text-[10px] font-black uppercase outline-none focus:border-indigo-600" placeholder="SKU or Name..." value={partSearch} onChange={e => setPartSearch(e.target.value)} />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                           {state.inventory.filter(i => i.name.toLowerCase().includes(partSearch.toLowerCase()) && i.quantity > 0).map(item => (
                                             <button key={item.id} type="button" onClick={() => addPartToRepair(item)} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-all">
                                                <div className="text-left"><p className="text-[10px] font-black text-slate-900 uppercase leading-none">{item.name}</p><p className="text-[8px] font-black text-slate-400 uppercase mt-1">Stock: {item.quantity} • {item.isIMEIBased ? 'Serialized' : 'Bulk'}</p></div>
                                                <ChevronRight size={14} className="text-slate-300"/>
                                             </button>
                                           ))}
                                        </div>
                                     </div>
                                   )}
                                </div>
                             </div>
                             <div className="border-2 border-slate-50 rounded-[2.5rem] overflow-hidden bg-slate-50/30">
                                <table className="w-full text-left">
                                   <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                      <tr><th className="px-6 py-4">Component Descriptor</th><th className="px-6 py-4 text-center">Vol</th><th className="px-6 py-4 text-right">Value</th><th className="px-6 py-4 text-center">#</th></tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100">
                                      {newRepair.usedParts?.map(part => (
                                        <tr key={part.itemId} className="bg-white">
                                          <td className="px-6 py-4">
                                            <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{part.name}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {part.isIMEIBased && part.selectedImeis?.map(i => <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[7px] font-black rounded border border-indigo-100 font-mono">#{i}</span>)}
                                              {part.isIMEIBased && (
                                                <button type="button" onClick={() => { setActivePartItemId(part.itemId); setIsIMEIPickerOpen(true); }} className="px-2 py-0.5 bg-slate-900 text-white text-[7px] font-black rounded flex items-center gap-1 hover:bg-indigo-600 transition-colors">
                                                  <Smartphone size={8}/> Selection Mandatory
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-6 py-4 text-center font-black text-[11px] text-slate-900">{part.quantity}</td>
                                          <td className="px-6 py-4 text-right font-black text-[11px] text-slate-900">{(part.cost * part.quantity).toLocaleString()}</td>
                                          <td className="px-6 py-4 text-center"><button type="button" onClick={() => setNewRepair({...newRepair, usedParts: newRepair.usedParts?.filter(p => p.itemId !== part.itemId)})} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={14}/></button></td>
                                        </tr>
                                      ))}
                                      {(!newRepair.usedParts || newRepair.usedParts.length === 0) && (
                                        <tr><td colSpan={4} className="py-20 text-center text-slate-200 uppercase font-black text-[9px] tracking-widest"><Box size={32} className="mx-auto mb-2 opacity-50"/> No components added to job</td></tr>
                                      )}
                                   </tbody>
                                </table>
                             </div>
                          </div>
                          
                          <div className="space-y-6">
                             <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={16}/> Service Description</h3>
                             <textarea required className="w-full px-6 py-5 bg-slate-50 border rounded-[2rem] outline-none font-black text-sm uppercase shadow-inner h-40 resize-none" placeholder="DIAGNOSIS & ISSUE LOG..." value={newRepair.issue} onChange={e => setNewRepair({...newRepair, issue: e.target.value})} />
                             <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Technician Reference</label>
                                <input className="w-full px-6 py-4 bg-slate-50 border rounded-2xl outline-none font-black text-xs uppercase shadow-inner" value={newRepair.technician} onChange={e => setNewRepair({...newRepair, technician: e.target.value})} />
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="px-12 py-8 bg-slate-50 border-t flex items-center justify-between">
                       <div className="flex gap-10 items-center">
                          <div className="flex items-center gap-6 bg-white px-8 py-4 rounded-[2rem] border-2 border-slate-100 shadow-sm">
                             <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Quote</p><p className="text-3xl font-black text-slate-900 leading-none tracking-tighter">{state.settings.currency} {newRepair.estimatedCost?.toLocaleString()}</p></div>
                             <div className="w-px h-10 bg-slate-100"></div>
                             <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">COGS (Parts)</p><p className="text-xl font-black text-indigo-600 leading-none">{(newRepair.usedParts || []).reduce((s,p) => s + (p.cost * p.quantity), 0).toLocaleString()}</p></div>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="text-right">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Billing</p>
                             <input type="number" className="w-32 bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 text-right font-black text-lg outline-none focus:border-indigo-600" value={newRepair.estimatedCost || ''} onChange={e => setNewRepair({...newRepair, estimatedCost: parseFloat(e.target.value) || 0})} />
                          </div>
                          <button type="submit" className="px-16 py-6 bg-slate-900 text-white font-black rounded-full uppercase tracking-widest text-[11px] shadow-2xl hover:bg-indigo-600 hover:scale-105 transform transition-all flex items-center gap-4">
                             {pendingAction?.type === 'edit' ? 'Update Entry' : 'Authorize Job'} <CircleCheckBig size={24}/>
                          </button>
                       </div>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* VOUCHER VIEW WITH POWERED BY BRANDING */}
      {reportRepairId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in duration-200">
             {(() => {
                const repair = state.repairs.find(r => r.id === reportRepairId)!;
                
                const handlePrint = async () => {
                  const printerType = state.settings.printerType;
                  if (!printerType) {
                    alert("Printer Configuration Missing: Please set up a default printer in the Settings module before printing.");
                    return;
                  }
                  if (printerType === 'pdf') {
                    try {
                      // @ts-ignore
                      const html2pdf = (await import('html2pdf.js')).default;
                      const element = document.getElementById('repair-report-print');
                      if (!element) return;
                      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
                      const opt = {
                        margin:       0.5,
                        filename:     `Repair_Voucher_${repair.id.slice(0,8)}_${dateStr}.pdf`,
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
                  <>
                    <div className="p-8 border-b bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg"><Receipt size={24}/></div>
                        <div><h2 className="text-lg font-black uppercase tracking-tight leading-none">Job Voucher #{repair.id.slice(0,8)}</h2><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{repair.status}</p></div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={handlePrint} className="bg-slate-800 text-white p-2.5 rounded-xl"><Printer size={20}/></button>
                         <button onClick={() => setReportRepairId(null)} className="bg-slate-800 text-white p-2.5 rounded-xl hover:bg-red-600"><X size={20}/></button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-12 space-y-12 bg-white" id="repair-report-print">
                      <div className="flex justify-between items-start border-b-2 border-slate-100 pb-10">
                         <div><h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">ACCOUNTAID</h1><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 tracking-[0.2em]">Hardware Service Intelligence</p></div>
                         <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt Log</p><p className="font-black text-slate-900 text-xl uppercase leading-none tracking-tighter">{formatAppDate(repair.receivedDate, state.settings.dateSystem)}</p></div>
                      </div>
                      <div className="grid grid-cols-2 gap-10">
                         <div className="space-y-6">
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Account Particulars</p><p className="text-xl font-black text-slate-900 uppercase leading-none">{repair.customerName}</p><p className="text-xs font-bold text-slate-500 mt-1">{repair.customerPhone}</p></div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Job Context / Issue</p><p className="text-xs font-black text-indigo-600 uppercase leading-relaxed">{repair.issue}</p></div>
                         </div>
                         <div className="text-right space-y-6">
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hardware Instance</p><p className="text-xl font-black text-slate-900 uppercase leading-none">{repair.model}</p><p className="text-[11px] font-mono font-black text-slate-500 uppercase mt-2">DEVICE S/N: {repair.imei}</p></div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Desk</p><p className="text-xs font-black text-slate-900 uppercase">{repair.technician}</p></div>
                         </div>
                      </div>

                      {repair.usedParts.length > 0 && (
                        <div className="space-y-4">
                           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Box size={14}/> Components & Parts Utilized</h3>
                           <div className="border rounded-[2rem] overflow-hidden bg-slate-50/30">
                              <table className="w-full text-left">
                                 <thead className="bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b">
                                    <tr><th className="px-6 py-4">Item</th><th className="px-6 py-4 text-center">Vol</th><th className="px-6 py-4 text-right">Net Value</th></tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {repair.usedParts.map((p, idx) => (
                                      <tr key={idx} className="bg-white">
                                        <td className="px-6 py-4">
                                          <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{p.name}</p>
                                          {p.selectedImeis && p.selectedImeis.length > 0 && (
                                            <p className="text-[8px] font-mono text-indigo-600 font-black mt-1 uppercase">S/N: {p.selectedImeis.join(', ')}</p>
                                          )}
                                        </td>
                                        <td className="px-6 py-4 text-center font-black text-[10px]">{p.quantity}</td>
                                        <td className="px-6 py-4 text-right font-black text-[10px]">{(p.cost * p.quantity).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-8 border-t-2 border-slate-50">
                        {repair.deliveredBy ? (
                          <div className="flex items-center gap-4">
                             <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><ShieldCheck size={32}/></div>
                             <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Verified Release</p><p className="text-lg font-black text-slate-900 uppercase leading-none tracking-tight">{repair.deliveredBy}</p></div>
                          </div>
                        ) : (
                          <div>
                            {repair.status === RepairStatus.COMPLETED && (
                              <button onClick={() => { setReportRepairId(null); handleNextStage(repair.id, repair.status); }} className="px-6 py-3 bg-emerald-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2">
                                <ShieldCheck size={16}/> Mark as Delivered
                              </button>
                            )}
                          </div>
                        )}
                        <div className="w-80 bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl">
                           <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest"><span>Service Fee</span><span>{repair.estimatedCost.toLocaleString()}</span></div>
                           <div className="flex justify-between text-3xl font-black pt-6 border-t border-white/10 tracking-tighter leading-none"><span>NET DUE</span><span>{state.settings.currency}{repair.estimatedCost.toLocaleString()}</span></div>
                        </div>
                      </div>
                      
                      <div className="pt-10 text-center text-slate-300 text-[8px] font-black uppercase tracking-[0.4em]">
                        Powered by Rajan Dhamala and Associate
                      </div>
                    </div>
                  </>
                );
             })()}
          </div>
        </div>
      )}

      {isDeliveryModalOpen && pendingAction?.id && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 animate-in zoom-in duration-200">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Finalize Delivery</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Authorize Release & Generate Invoice</p>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Releasing Staff Name</label>
                <input 
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-black text-sm uppercase focus:border-emerald-500 transition-all" 
                  placeholder="e.g. John Doe"
                  value={deliveryStaffName} 
                  onChange={e => setDeliveryStaffName(e.target.value)} 
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button onClick={() => { setIsDeliveryModalOpen(false); setPendingAction(null); }} className="py-4 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-colors">Cancel</button>
                <button onClick={finalizeStatusUpdate} disabled={!deliveryStaffName.trim()} className="py-4 bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all disabled:opacity-50">Confirm Release</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Repairs;
