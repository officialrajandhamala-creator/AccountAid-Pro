
import React, { useState } from 'react';
import { AppState, InventoryItem, SuperAdminSession } from '../types';
import { 
  Plus, Search, Trash2, Edit2, Package, Smartphone, 
  X, CircleCheckBig, Info, Download, Eye, Layers
} from 'lucide-react';
import { getCurrentDateStr } from '../utils/dateUtils';
import { downloadCSV } from '../utils/exportUtils';
import PinModal from '../components/PinModal';

interface InventoryProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeUser: any;
  superAdminSession: SuperAdminSession | null;
}

const Inventory: React.FC<InventoryProps> = ({ state, setState, activeUser, superAdminSession }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'edit', id: string } | null>(null);
  const [imeiEntry, setImeiEntry] = useState('');

  const isAdmin = activeUser?.role === 'admin';

  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '', sku: '', category: 'General', quantity: 0, minStockLevel: 5, isIMEIBased: false,
    purchasePrice: 0, salePrice: 0, imeis: [], units: [], locationId: state.locations[0]?.id || 'default'
  });

  const filteredItems = state.inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.imeis.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExport = () => {
    const exportData = filteredItems.map(item => ({
      'Model Name': item.name,
      'SKU': item.sku,
      'Category': item.category,
      'In Stock QTY': item.quantity,
      'Serial Numbers (IMEIs)': item.imeis.join(', '),
      'Unit Cost': item.purchasePrice,
      'Selling Price': item.salePrice,
      'Godown': state.locations.find(l => l.id === item.locationId)?.name
    }));
    downloadCSV(exportData, 'Global_Asset_Registry');
  };

  const handleAddImei = () => {
    const val = imeiEntry.trim().toUpperCase();
    if (!val) return;
    
    const existsGlobally = state.inventory.some(item => item.imeis.includes(val));
    if (existsGlobally) {
      alert(`BLOCK: IMEI [${val}] is already registered in stock.`);
      return;
    }
    
    if (newItem.imeis?.includes(val)) {
      alert(`Entry Error: Serial [${val}] is already in the pending list.`);
      return;
    }
    
    setNewItem(prev => ({
      ...prev,
      imeis: [...(prev.imeis || []), val],
      units: [...(prev.units || []), { imei: val, purchasePrice: prev.purchasePrice || 0, salePrice: prev.salePrice || 0 }],
      quantity: (prev.imeis?.length || 0) + 1
    }));
    setImeiEntry('');
  };

  const removeImei = (imei: string) => {
    setNewItem(prev => ({
      ...prev,
      imeis: prev.imeis?.filter(i => i !== imei),
      units: prev.units?.filter(u => u.imei !== imei),
      quantity: Math.max(0, (prev.imeis?.length || 1) - 1)
    }));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.sku) return alert("Validation: Name and SKU are mandatory.");
    
    const itemData = {
      ...newItem,
      quantity: newItem.isIMEIBased ? (newItem.imeis?.length || 0) : (newItem.quantity || 0),
      createdBy: activeUser.name
    } as InventoryItem;

    setState(prev => {
      let currentInventory = [...prev.inventory];
      if (pendingAction?.type === 'edit') {
        currentInventory = currentInventory.map(i => {
          if (i.id === pendingAction.id) {
            // Do not overwrite quantity, imeis, and units when editing, as they are managed by transactions
            const { quantity, imeis, units, ...restItemData } = itemData;
            return { ...i, ...restItemData, id: pendingAction.id };
          }
          return i;
        });
      } else {
        currentInventory.push({ 
          ...itemData, 
          id: crypto.randomUUID(), 
          purchaseDate: getCurrentDateStr(), 
          partyName: 'Opening Stock' 
        });
      }
      return { ...prev, inventory: currentInventory };
    });

    setIsModalOpen(false);
    resetNewItem();
  };

  const resetNewItem = () => {
    setNewItem({ name: '', sku: '', category: 'General', quantity: 0, minStockLevel: 5, purchasePrice: 0, salePrice: 0, imeis: [], units: [], isIMEIBased: false, locationId: state.locations[0]?.id });
    setPendingAction(null);
    setImeiEntry('');
  };

  const executeAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'delete') {
      setState(prev => ({ ...prev, inventory: prev.inventory.filter(i => i.id !== pendingAction.id) }));
    } else if (pendingAction.type === 'edit') {
      const item = state.inventory.find(i => i.id === pendingAction.id);
      if (item) { setNewItem(item); setIsModalOpen(true); }
    }
    setIsPinModalOpen(false);
  };

  const triggerAction = (type: 'delete' | 'edit', id: string) => {
    setPendingAction({ type, id });
    if (superAdminSession) {
      // Bypass PIN for SuperAdmin
      if (type === 'delete') {
        setState(prev => ({ ...prev, inventory: prev.inventory.filter(i => i.id !== id) }));
      } else {
        const item = state.inventory.find(i => i.id === id);
        if (item) { setNewItem(item); setIsModalOpen(true); }
      }
    } else {
      setIsPinModalOpen(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Stock Master</h1>
          <p className="text-slate-500 font-bold uppercase text-[8px] md:text-[9px] mt-2 tracking-widest">Global Asset Directory</p>
        </div>
        <div className="flex gap-2 md:gap-3 w-full sm:w-auto">
          <button onClick={handleExport} className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-600 px-4 md:px-6 py-3 rounded-2xl font-black text-[9px] md:text-[10px] uppercase shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><Download size={16}/> Export</button>
          <button onClick={() => { resetNewItem(); setIsModalOpen(true); }} className="flex-1 sm:flex-none bg-blue-600 text-white px-6 md:px-8 py-3 rounded-2xl font-black text-[9px] md:text-[10px] uppercase shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"><Plus size={16}/> New Entry</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border flex gap-4"><Search className="text-slate-400" size={20} /><input type="text" placeholder="Lookup model, SKU, or Serial Number..." className="w-full bg-transparent outline-none font-bold text-sm uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">In-Stock</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial Assets (IMEIs)</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-6">
                    <div className="flex gap-4 text-left">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${item.isIMEIBased ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{item.isIMEIBased ? <Smartphone size={24} /> : <Package size={24} />}</div>
                      <div>
                        <p className="font-black text-slate-900 text-base uppercase tracking-tight leading-none mb-1">{item.name}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none">SKU: {item.sku} • {state.locations.find(l => l.id === item.locationId)?.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <p className="text-xl font-black text-slate-900 leading-none">{item.quantity}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase mt-1 inline-block ${item.quantity <= item.minStockLevel ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>{item.quantity <= item.minStockLevel ? 'Low' : 'Stable'}</span>
                  </td>
                  <td className="px-6 py-6">
                     <div className="flex flex-wrap gap-1 max-w-lg max-h-24 overflow-y-auto custom-scrollbar">
                        {item.isIMEIBased ? (
                          item.imeis.map(i => <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-mono font-black rounded border border-slate-200">{i}</span>)
                        ) : (
                          <span className="text-[9px] text-slate-300 font-bold uppercase italic">Bulk Ledger</span>
                        )}
                     </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setDetailItem(item)} className="p-3 text-slate-300 hover:text-indigo-600 transition-all hover:bg-indigo-50 rounded-xl"><Eye size={18}/></button>
                      {isAdmin && (
                        <>
                          <button onClick={() => triggerAction('edit', item.id)} className="p-3 text-slate-300 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-xl"><Edit2 size={18}/></button>
                          <button onClick={() => triggerAction('delete', item.id)} className="p-3 text-slate-300 hover:text-red-500 transition-all hover:bg-red-50 rounded-xl"><Trash2 size={18}/></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PinModal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} onSuccess={executeAction} correctPin={state.settings.securityPin} />

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] animate-in zoom-in duration-300">
            <div className="px-10 py-6 border-b bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Package size={28}/></div>
                <div><h2 className="text-xl font-black uppercase tracking-tight leading-none">Stock Registry Entry</h2></div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-4xl text-slate-400 hover:text-white transition-all">&times;</button>
            </div>
            
            <form onSubmit={handleAddItem} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
               <div className="p-10 grid grid-cols-2 gap-8 bg-white">
                  <div className="col-span-2 flex items-center gap-6 p-6 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
                     <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-4">Entry Modality</label>
                        <div className="flex bg-white p-1.5 rounded-2xl shadow-inner border">
                           <button type="button" disabled={pendingAction?.type === 'edit'} onClick={() => setNewItem({...newItem, isIMEIBased: false})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed ${!newItem.isIMEIBased ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Bulk Entry</button>
                           <button type="button" disabled={pendingAction?.type === 'edit'} onClick={() => setNewItem({...newItem, isIMEIBased: true})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed ${newItem.isIMEIBased ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Serialized</button>
                        </div>
                     </div>
                     <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-4">Godown Location</label>
                        <select className="w-full px-6 py-4 bg-white border rounded-2xl outline-none font-black text-xs uppercase" value={newItem.locationId} onChange={e => setNewItem({...newItem, locationId: e.target.value})}>
                          {state.locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                        </select>
                     </div>
                  </div>

                  <div className="space-y-6">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase ml-4 mb-2 block">SKU Code</label><input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black text-sm uppercase shadow-inner outline-none focus:border-blue-600" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} /></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase ml-4 mb-2 block">Model Name</label><input required className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black text-sm uppercase shadow-inner outline-none focus:border-blue-600" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-black text-slate-400 uppercase ml-4 mb-2 block">Purchase Rate</label><input type="number" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black shadow-inner outline-none focus:border-blue-600" value={newItem.purchasePrice || ''} onChange={e => setNewItem({...newItem, purchasePrice: parseFloat(e.target.value) || 0})} /></div>
                      <div><label className="text-[10px] font-black text-slate-400 uppercase ml-4 mb-2 block">Selling Rate</label><input type="number" className="w-full px-6 py-4 bg-slate-50 border rounded-2xl font-black shadow-inner outline-none focus:border-blue-600" value={newItem.salePrice || ''} onChange={e => setNewItem({...newItem, salePrice: parseFloat(e.target.value) || 0})} /></div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {newItem.isIMEIBased ? (
                       <div className="bg-slate-900 rounded-[2.5rem] p-8 h-full flex flex-col shadow-2xl">
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2"><Smartphone size={14}/> Opening Serials</h3>
                          <div className="flex gap-2 mb-6">
                             <input disabled={pendingAction?.type === 'edit'} className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white font-mono font-black text-sm outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" placeholder="SCAN SERIAL ID..." value={imeiEntry} onChange={e => setImeiEntry(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddImei())} />
                             <button type="button" disabled={pendingAction?.type === 'edit'} onClick={handleAddImei} className="bg-blue-600 text-white px-6 rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={24}/></button>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                             {newItem.imeis?.map(i => (
                               <div key={i} className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700 hover:border-red-500 transition-all">
                                  <span className="text-xs font-mono font-black text-blue-400">{i}</span>
                                  <button type="button" disabled={pendingAction?.type === 'edit'} onClick={() => removeImei(i)} className="text-slate-600 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"><X size={16}/></button>
                               </div>
                             ))}
                          </div>
                       </div>
                    ) : (
                       <div className="bg-slate-50 rounded-[2.5rem] p-10 border-2 border-dashed border-slate-200 shadow-inner flex flex-col items-center justify-center text-center space-y-6">
                          <Package className="text-slate-200" size={64}/>
                          <div className="w-full">
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Opening Quantity</label>
                            <input type="number" disabled={pendingAction?.type === 'edit'} className="w-full text-center text-4xl font-black py-4 bg-white border-2 border-slate-100 rounded-3xl outline-none focus:border-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" value={newItem.quantity || ''} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value) || 0})} placeholder="0" />
                          </div>
                       </div>
                    )}
                  </div>
               </div>
               
               <div className="mt-auto px-10 py-8 bg-slate-50 border-t flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impact Value</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">{state.settings.currency} {((newItem.isIMEIBased ? (newItem.imeis?.length || 0) : (newItem.quantity || 0)) * (newItem.purchasePrice || 0)).toLocaleString()}</p>
                  </div>
                  <button type="submit" className="px-12 py-5 bg-blue-600 text-white font-black rounded-full uppercase tracking-widest text-[11px] shadow-2xl hover:bg-blue-700 transition-all flex items-center gap-4">
                    Confirm Registry <CircleCheckBig size={24}/>
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {detailItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="p-8 border-b bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Info size={28}/></div>
                    <div><h2 className="text-xl font-black uppercase tracking-tight leading-none">{detailItem.name}</h2><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Granular Asset Log</p></div>
                 </div>
                 <button onClick={() => setDetailItem(null)} className="text-3xl text-slate-400 hover:text-white transition-colors">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Quantity</p><p className="text-3xl font-black text-slate-900">{detailItem.quantity} Units</p></div>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Global Valuation</p>
                      <p className="text-xl font-black text-slate-900">
                        {state.settings.currency} {((detailItem.units || []).reduce((s, u) => s + (u.purchasePrice || 0), 0) || (detailItem.quantity * detailItem.purchasePrice)).toLocaleString()}
                      </p>
                    </div>
                 </div>
                 
                 {detailItem.isIMEIBased && (
                    <div className="space-y-4">
                       <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><Layers size={16} className="text-blue-600"/> Serial-Wise Valuation Registry</h3>
                       <div className="p-2 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-4">
                            {(detailItem.units || []).map(u => (
                              <div key={u.imei} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Serial ID</p>
                                  <p className="font-mono text-xs font-black text-slate-900">#{u.imei}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cost Rate</p>
                                  <p className="text-xs font-black text-indigo-600">{state.settings.currency} {u.purchasePrice.toLocaleString()}</p>
                                </div>
                              </div>
                            ))}
                            {(detailItem.units || []).length === 0 && (
                               detailItem.imeis.map(i => (
                                 <div key={i} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                                   <p className="font-mono text-xs font-black text-slate-900">#{i}</p>
                                   <p className="text-xs font-black text-slate-300 italic">No granular rate logged</p>
                                 </div>
                               ))
                            )}
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
