import React, { useState, useMemo } from 'react';
import { AppState, InventoryItem, IMEIUnit, SuperAdminSession } from '../types';
import { 
  ArrowLeftRight, 
  MapPin, 
  Package, 
  Smartphone, 
  Search, 
  Plus, 
  X, 
  ShieldCheck, 
  ArrowRight,
  History,
  AlertCircle,
  Download,
  Calculator
} from 'lucide-react';
import { downloadCSV } from '../utils/exportUtils';
import PinModal from '../components/PinModal';

interface StockTransferProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  superAdminSession: SuperAdminSession | null;
}

const StockTransfer: React.FC<StockTransferProps> = ({ state, setState, superAdminSession }) => {
  const [sourceLocId, setSourceLocId] = useState('');
  const [targetLocId, setTargetLocId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [selectedImeis, setSelectedImeis] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const availableItems = useMemo(() => {
    if (!sourceLocId) return [];
    return state.inventory.filter(item => 
      item.locationId === sourceLocId && 
      item.quantity > 0 &&
      item.name.toLowerCase().includes(itemSearch.toLowerCase())
    );
  }, [sourceLocId, state.inventory, itemSearch]);

  const selectedItem = useMemo(() => 
    state.inventory.find(i => i.id === selectedItemId),
    [selectedItemId, state.inventory]
  );

  const transferValuation = useMemo(() => {
    if (!selectedItem) return 0;
    if (selectedItem.isIMEIBased) {
      const unitsToMove = selectedItem.units?.filter(u => selectedImeis.includes(u.imei)) || [];
      return unitsToMove.reduce((sum, u) => sum + u.purchasePrice, 0);
    }
    return transferQty * selectedItem.purchasePrice;
  }, [selectedItem, selectedImeis, transferQty]);

  const exportCurrentAvailableToExcel = () => {
    if (!sourceLocId) return alert("Select a source godown first.");
    const data = availableItems.map(item => ({
      'Item Name': item.name,
      'Source Godown': state.locations.find(l => l.id === sourceLocId)?.name,
      'Available Qty': item.quantity,
      'IMEIs': item.imeis.join('; '),
      'Is Serialized': item.isIMEIBased ? 'YES' : 'NO'
    }));
    downloadCSV(data, 'Godown_Stock_Report');
  };

  const handleTransferInit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !targetLocId) return;
    
    if (superAdminSession) {
      executeTransfer();
    } else {
      setIsPinModalOpen(true);
    }
  };

  const executeTransfer = () => {
    if (!selectedItem || !targetLocId || !sourceLocId) return;

    setState(prev => {
      let updatedInventory = [...prev.inventory];
      const sourceIdx = updatedInventory.findIndex(i => i.id === selectedItem.id);
      const sourceItem = { ...updatedInventory[sourceIdx] };

      let unitsToMove: IMEIUnit[] = [];

      // Requirement: Update source inventory values and quantity
      if (sourceItem.isIMEIBased) {
        unitsToMove = sourceItem.units?.filter(u => selectedImeis.includes(u.imei)) || [];
        sourceItem.units = sourceItem.units?.filter(u => !selectedImeis.includes(u.imei));
        sourceItem.imeis = sourceItem.imeis.filter(i => !selectedImeis.includes(i));
        sourceItem.quantity = sourceItem.imeis.length;
      } else {
        sourceItem.quantity -= transferQty;
      }
      updatedInventory[sourceIdx] = sourceItem;

      // Requirement: Update target inventory values and quantity
      const targetIdx = updatedInventory.findIndex(i => 
        i.name === sourceItem.name && 
        i.category === sourceItem.category && 
        i.locationId === targetLocId
      );

      const qtyToMove = sourceItem.isIMEIBased ? selectedImeis.length : transferQty;

      if (targetIdx > -1) {
        const targetItem = { ...updatedInventory[targetIdx] };
        targetItem.quantity += qtyToMove;
        if (sourceItem.isIMEIBased) {
          targetItem.imeis = [...targetItem.imeis, ...selectedImeis];
          targetItem.units = [...(targetItem.units || []), ...unitsToMove];
        }
        updatedInventory[targetIdx] = targetItem;
      } else {
        const newItem: InventoryItem = {
          ...sourceItem,
          id: crypto.randomUUID(),
          locationId: targetLocId,
          quantity: qtyToMove,
          imeis: sourceItem.isIMEIBased ? [...selectedImeis] : [],
          units: sourceItem.isIMEIBased ? [...unitsToMove] : []
        };
        updatedInventory.push(newItem);
      }

      return { ...prev, inventory: updatedInventory };
    });

    setIsPinModalOpen(false);
    setSelectedItemId('');
    setTransferQty(1);
    setSelectedImeis([]);
    alert("System Update: Inventory values and quantities adjusted across locations.");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Inventory Relocation</h1>
          <p className="text-slate-500 font-medium">Inter-Godown Asset Transfer & Real-time Valuation Adjustment.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={exportCurrentAvailableToExcel}
             className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-black uppercase transition-all hover:bg-emerald-100"
           >
             <Download size={16}/> Export Stock List
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-[2.5rem] shadow-sm border p-8">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
              Source & Item Picker
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Select Origin Store</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    value={sourceLocId}
                    onChange={(e) => {
                      setSourceLocId(e.target.value);
                      setSelectedItemId('');
                      setSelectedImeis([]);
                    }}
                  >
                    <option value="">Choose Site...</option>
                    {state.locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Filter Items at Source</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search stock..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-50 transition-all uppercase"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {availableItems.map(item => (
                <button 
                  key={item.id}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setTransferQty(1);
                    setSelectedImeis([]);
                  }}
                  className={`p-4 rounded-3xl border text-left transition-all ${selectedItemId === item.id ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-900/20 ring-4 ring-blue-100' : 'bg-slate-50 border-slate-100 hover:border-blue-300'}`}
                >
                  <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${selectedItemId === item.id ? 'bg-white/20' : 'bg-white shadow-inner'}`}>
                    {item.isIMEIBased ? <Smartphone size={20} /> : <Package size={20} />}
                  </div>
                  <p className="font-black text-sm leading-tight mb-1 truncate uppercase">{item.name}</p>
                  <p className={`text-[9px] font-black uppercase ${selectedItemId === item.id ? 'text-blue-100' : 'text-slate-400'}`}>
                    Stock: {item.quantity} Units
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-[2.5rem] shadow-sm border p-8 sticky top-8">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
              Transfer Logistics
            </h2>

            {selectedItem ? (
              <form onSubmit={handleTransferInit} className="space-y-6 animate-in slide-in-from-right duration-300">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-3xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-blue-600">
                    {selectedItem.isIMEIBased ? <Smartphone /> : <Package />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Active Entry</p>
                    <p className="font-black text-slate-900 uppercase">{selectedItem.name}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Target Destination</label>
                  <select 
                    required
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-50"
                    value={targetLocId}
                    onChange={(e) => setTargetLocId(e.target.value)}
                  >
                    <option value="">Select Destination...</option>
                    {state.locations.filter(l => l.id !== sourceLocId).map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                {selectedItem.isIMEIBased ? (
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Serial IDs ({selectedImeis.length})</label>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {selectedItem.imeis.map(imei => (
                        <label key={imei} className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${selectedImeis.includes(imei) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-blue-200'}`}>
                          <span className="font-mono text-xs font-black">{imei}</span>
                          <input 
                            type="checkbox" 
                            className="hidden"
                            checked={selectedImeis.includes(imei)}
                            onChange={() => {
                              setSelectedImeis(prev => 
                                prev.includes(imei) ? prev.filter(i => i !== imei) : [...prev, imei]
                              );
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Movement Quantity (Max: {selectedItem.quantity})</label>
                    <input 
                      type="number"
                      min={1}
                      max={selectedItem.quantity}
                      required
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 outline-none"
                      value={transferQty}
                      onChange={(e) => setTransferQty(parseInt(e.target.value))}
                    />
                  </div>
                )}

                <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Valuation Estimate</p>
                  <div className="flex items-center justify-between">
                     <Calculator className="text-blue-400" size={24}/>
                     <p className="text-2xl font-black">{state.settings.currency}{transferValuation.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <button 
                    type="submit"
                    disabled={!targetLocId || (selectedItem.isIMEIBased ? selectedImeis.length === 0 : transferQty < 1)}
                    className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xs uppercase hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-3 disabled:bg-slate-200"
                  >
                    Commit Movement
                    <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-24 text-center text-slate-200 border-2 border-dashed border-slate-50 rounded-[2.5rem]">
                <ArrowLeftRight size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-[10px] font-black uppercase tracking-widest px-8">Pick an asset to begin logistics flow</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <PinModal 
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={executeTransfer}
        correctPin={state.settings.securityPin}
      />
    </div>
  );
};

export default StockTransfer;