
import React, { useState, useMemo } from 'react';
import { 
  AppState, 
  Transaction, 
  TransactionLineItem, 
  PaymentMethod, 
  InventoryItem,
  IMEIUnit,
  SuperAdminSession
} from '../types';
import { 
  Plus, Search, Trash2, Edit2, Receipt, 
  CircleCheckBig, ArrowRight, X, Calculator,
  Package, Smartphone, ShoppingCart, Calendar,
  AlertTriangle, Minus, Clipboard, CheckSquare, Square,
  Layers, DollarSign, Coins, Banknote, ArrowDownCircle, ArrowUpCircle,
  Undo2, RefreshCcw, Printer
} from 'lucide-react';
import { getCurrentDateStr, formatAppDate } from '../utils/dateUtils';
import PinModal from '../components/PinModal';
import BillModal from '../components/BillModal';

interface TransactionsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  activeUser: any;
  superAdminSession: SuperAdminSession | null;
}

const Transactions: React.FC<TransactionsProps> = ({ state, setState, activeUser, superAdminSession }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  
  const [txId, setTxId] = useState<string | null>(null);
  const [billNumber, setBillNumber] = useState('');
  const [txType, setTxType] = useState<'sale' | 'purchase' | 'receipt' | 'payment' | 'expense' | 'income' | 'sale_return' | 'purchase_return'>('sale');
  const [txDate, setTxDate] = useState(getCurrentDateStr());
  const [partyId, setPartyId] = useState('');
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('treasury-cash');
  const [description, setDescription] = useState('');
  const [directAmount, setDirectAmount] = useState<number>(0);
  const [isVatExempt, setIsVatExempt] = useState(false);
  const [manualTaxable, setManualTaxable] = useState<number | null>(null);
  const [manualTotal, setManualTotal] = useState<number | null>(null);
  
  const [receivedDenoms, setReceivedDenoms] = useState<Record<number, number>>({
    1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  });
  const [returnedDenoms, setReturnedDenoms] = useState<Record<number, number>>({
    1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  });
  const [cashTab, setCashTab] = useState<'received' | 'returned'>('received');

  const [imeiDataMap, setImeiDataMap] = useState<Record<string, { imei: string, price: number }[]>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'edit' | 'delete', targetTx: Transaction } | null>(null);
  const [selectedBillTx, setSelectedBillTx] = useState<Transaction | null>(null);

  const isStockTransaction = ['sale', 'purchase', 'sale_return', 'purchase_return'].includes(txType);
  const isDirectEntry = txType === 'income' || txType === 'expense';
  const isCashPayment = paymentMethod === 'treasury-cash';

  const calculatedSubTotal = useMemo(() => {
    if (!isStockTransaction) return directAmount;
    return lineItems.reduce((sum, li) => {
      let base = 0;
      if (txType === 'purchase' && li.isIMEIBased) {
        const data = imeiDataMap[li.lineId] || [];
        base = data.reduce((s, unit) => s + (unit.price || 0), 0);
      } else {
        base = li.price * li.quantity;
      }
      const discount = li.discountType === 'percentage' ? base * ((li.discountValue || 0) / 100) : (li.discountValue || 0);
      return sum + (base - discount);
    }, 0);
  }, [lineItems, imeiDataMap, txType, directAmount, isStockTransaction]);

  const { subTotal, vatAmount, totalAmount } = useMemo(() => {
    let finalTaxable = calculatedSubTotal;
    let finalVat = 0;
    let finalTotal = 0;

    if (isStockTransaction) {
      if (manualTotal !== null) {
        finalTotal = manualTotal;
        if (state.settings.vatEnabled && !isVatExempt) {
          finalTaxable = finalTotal / (1 + state.settings.vatRate / 100);
          finalVat = finalTotal - finalTaxable;
        } else {
          finalTaxable = finalTotal;
          finalVat = 0;
        }
      } else if (manualTaxable !== null) {
        finalTaxable = manualTaxable;
        if (state.settings.vatEnabled && !isVatExempt) {
          finalVat = finalTaxable * (state.settings.vatRate / 100);
          finalTotal = finalTaxable + finalVat;
        } else {
          finalVat = 0;
          finalTotal = finalTaxable;
        }
      } else {
        finalTaxable = calculatedSubTotal;
        if (state.settings.vatEnabled && !isVatExempt) {
          finalVat = finalTaxable * (state.settings.vatRate / 100);
          finalTotal = finalTaxable + finalVat;
        } else {
          finalVat = 0;
          finalTotal = finalTaxable;
        }
      }
    } else {
      finalTotal = directAmount;
    }

    return { subTotal: finalTaxable, vatAmount: finalVat, totalAmount: finalTotal };
  }, [calculatedSubTotal, manualTaxable, manualTotal, isStockTransaction, state.settings.vatEnabled, state.settings.vatRate, isVatExempt, directAmount]);

  const receivedTotal = useMemo(() => 
    (Object.entries(receivedDenoms) as [string, number][]).reduce((sum, [val, qty]) => sum + (Number(val) * qty), 0)
  , [receivedDenoms]);

  const returnedTotal = useMemo(() => 
    (Object.entries(returnedDenoms) as [string, number][]).reduce((sum, [val, qty]) => sum + (Number(val) * qty), 0)
  , [returnedDenoms]);

  const cashNetImpact = useMemo(() => receivedTotal - returnedTotal, [receivedTotal, returnedTotal]);

  const requiredCashNet = useMemo(() => {
    return ['sale', 'income', 'receipt', 'purchase_return'].includes(txType) ? totalAmount : -totalAmount;
  }, [txType, totalAmount]);

  const handleAddLine = (item: InventoryItem | { name: string, sku: string, isIMEIBased: boolean, id?: string }) => {
    setManualTaxable(null);
    setManualTotal(null);
    setLineItems(prev => {
      const existingIdx = prev.findIndex(li => li.itemId === item.id || (li.sku === item.sku && li.sku !== ''));
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + 1 };
        return updated;
      }
      const isExisting = !!(item as InventoryItem).id;
      const newLineId = crypto.randomUUID();
      const newLine: TransactionLineItem = {
        lineId: newLineId,
        itemId: (item as InventoryItem).id || `TEMP-${crypto.randomUUID()}`,
        name: item.name, sku: item.sku || `SKU-${Date.now()}`, quantity: 1, isIMEIBased: item.isIMEIBased,
        price: isExisting ? (['purchase', 'purchase_return'].includes(txType) ? (item as InventoryItem).purchasePrice : (item as InventoryItem).salePrice) : 0,
        selectedImeis: []
      };
      if (item.isIMEIBased) {
        setImeiDataMap(prevMap => ({ ...prevMap, [newLineId]: [{ imei: '', price: newLine.price }] }));
      }
      return [...prev, newLine];
    });
    setIsItemPickerOpen(false);
    setItemSearch('');
  };

  const updateLineQty = (lineId: string, val: number) => {
    setManualTaxable(null);
    setManualTotal(null);
    const newQty = Math.max(1, val);
    setLineItems(prev => prev.map(li => {
      if (li.lineId === lineId) {
        const newImeis = li.isIMEIBased ? (li.selectedImeis || []).slice(0, newQty) : li.selectedImeis;
        return { ...li, quantity: newQty, selectedImeis: newImeis };
      }
      return li;
    }));
    if (['purchase', 'sale_return'].includes(txType)) {
      setImeiDataMap(prev => {
        const current = [...(prev[lineId] || [])];
        if (current.length < newQty) {
          const lastPrice = current.length > 0 ? current[current.length - 1].price : 0;
          while (current.length < newQty) current.push({ imei: '', price: lastPrice });
        } else {
          current.length = newQty;
        }
        return { ...prev, [lineId]: current };
      });
    }
  };

  const removeLine = (lineId: string) => {
    setManualTaxable(null);
    setManualTotal(null);
    setLineItems(prev => prev.filter(li => li.lineId !== lineId));
    if (['purchase', 'sale_return'].includes(txType)) {
      setImeiDataMap(prev => {
        const next = { ...prev };
        delete next[lineId];
        return next;
      });
    }
  };

  const setImeiAtSlot = (lineId: string, index: number, imei: string) => {
    const upImei = imei.trim().toUpperCase();
    if (upImei) {
      const existsInStock = state.inventory.some(item => item.imeis.includes(upImei));
      const isFromCurrentTx = txId && state.transactions.find(t => t.id === txId)?.items?.some(li => li.selectedImeis?.includes(upImei));
      if (existsInStock && !isFromCurrentTx && ['purchase', 'sale_return'].includes(txType)) {
        alert(`Duplicate IMEI Blocked: [${upImei}] already exists in stock.`);
        return;
      }
    }
    if (['purchase', 'sale_return'].includes(txType)) {
      setImeiDataMap(prev => {
        const units = [...(prev[lineId] || [])];
        if (units[index]) units[index].imei = upImei;
        return { ...prev, [lineId]: units };
      });
    } else {
      setLineItems(prev => prev.map(li => {
        if (li.lineId === lineId) {
          const newImeis = [...(li.selectedImeis || [])];
          while (newImeis.length < li.quantity) newImeis.push('');
          newImeis[index] = upImei;
          return { ...li, selectedImeis: newImeis };
        }
        return li;
      }));
    }
  };

  const updateDenom = (target: 'received' | 'returned', val: number, qty: number) => {
    const setter = target === 'received' ? setReceivedDenoms : setReturnedDenoms;
    setter(prev => ({ ...prev, [val]: Math.max(0, qty) }));
  };

  const executeReversal = (tx: Transaction) => {
    setState(prev => {
      let updatedInventory = [...prev.inventory];
      let updatedParties = [...prev.parties];
      let updatedVault = { ...prev.cashVault };

      if (['sale', 'purchase', 'sale_return', 'purchase_return'].includes(tx.type)) {
        tx.items?.forEach(li => {
          const invIdx = updatedInventory.findIndex(i => i.id === li.itemId);
          if (invIdx > -1) {
            const invItem = { ...updatedInventory[invIdx] };
            if (tx.type === 'sale' || tx.type === 'purchase_return') {
              invItem.quantity += li.quantity;
              if (li.isIMEIBased && li.selectedImeis) {
                invItem.imeis = [...invItem.imeis, ...li.selectedImeis];
                const restoredUnits = li.selectedImeis.map(imei => ({
                  imei,
                  purchasePrice: invItem.purchasePrice,
                  salePrice: invItem.salePrice
                }));
                invItem.units = [...(invItem.units || []), ...restoredUnits];
              }
            } else if (tx.type === 'purchase' || tx.type === 'sale_return') {
              invItem.quantity -= li.quantity;
              if (li.isIMEIBased && li.selectedImeis) {
                invItem.imeis = invItem.imeis.filter(i => !li.selectedImeis!.includes(i));
                invItem.units = (invItem.units || []).filter(u => !li.selectedImeis!.includes(u.imei));
              }
            }
            updatedInventory[invIdx] = invItem;
          }
        });
      }

      if (tx.paymentMethod === 'treasury-cash') {
        if (tx.receivedDenominations) {
          (Object.entries(tx.receivedDenominations) as [string, number][]).forEach(([val, qty]) => {
            updatedVault[Number(val)] -= qty;
          });
        }
        if (tx.returnedDenominations) {
          (Object.entries(tx.returnedDenominations) as [string, number][]).forEach(([val, qty]) => {
            updatedVault[Number(val)] += qty;
          });
        }
      }

      if (tx.type === 'transfer' && tx.fromPartyId && tx.toPartyId) {
        const fromIdx = updatedParties.findIndex(p => p.id === tx.fromPartyId);
        const toIdx = updatedParties.findIndex(p => p.id === tx.toPartyId);
        if (fromIdx > -1) updatedParties[fromIdx] = { ...updatedParties[fromIdx], balance: updatedParties[fromIdx].balance + tx.totalAmount };
        if (toIdx > -1) updatedParties[toIdx] = { ...updatedParties[toIdx], balance: updatedParties[toIdx].balance - tx.totalAmount };
      }

      if (tx.partyId) {
        const partyIdx = updatedParties.findIndex(p => p.id === tx.partyId);
        if (partyIdx > -1) {
          const party = { ...updatedParties[partyIdx] };
          // REVERSAL LOGIC
          if (tx.type === 'sale') {
            if (tx.paymentMethod === 'Credit') party.balance -= tx.totalAmount;
          } else if (tx.type === 'purchase') {
            if (tx.paymentMethod === 'Credit') party.balance += tx.totalAmount;
          } else if (tx.type === 'sale_return') {
            if (tx.paymentMethod === 'Credit') party.balance += tx.totalAmount;
          } else if (tx.type === 'purchase_return') {
            if (tx.paymentMethod === 'Credit') party.balance -= tx.totalAmount;
          } else if (tx.type === 'receipt') {
            party.balance += tx.totalAmount;
          } else if (tx.type === 'payment') {
            party.balance -= tx.totalAmount;
          } else if (tx.type === 'income') {
            party.balance += tx.totalAmount;
          } else if (tx.type === 'expense') {
            party.balance -= tx.totalAmount;
          }
          updatedParties[partyIdx] = party;
        }
      }

      if (tx.paymentMethod !== 'Credit') {
        const treasuryIdx = updatedParties.findIndex(p => p.id === tx.paymentMethod);
        if (treasuryIdx > -1) {
          const treasury = { ...updatedParties[treasuryIdx] };
          if (['sale', 'income', 'receipt', 'purchase_return'].includes(tx.type)) treasury.balance -= tx.totalAmount;
          else if (['purchase', 'payment', 'expense', 'sale_return'].includes(tx.type)) treasury.balance += tx.totalAmount;
          updatedParties[treasuryIdx] = treasury;
        }
      }

      return { ...prev, inventory: updatedInventory, parties: updatedParties, cashVault: updatedVault, transactions: prev.transactions.filter(t => t.id !== tx.id) };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirectEntry && !partyId) return alert("Validation: Ledger Account is mandatory for this entry type.");
    if (isDirectEntry && paymentMethod === 'Credit' && !partyId) return alert("Validation: Ledger Account is mandatory for Credit entries.");
    
    if (isCashPayment && cashNetImpact !== requiredCashNet) {
      return alert(`Denomination Mismatch:\nNet Impact Needed: ${requiredCashNet}\nYour Breakdown Impact: ${cashNetImpact}\n\nNote: Net Impact = Cash In - Cash Out`);
    }

    if (isStockTransaction && lineItems.length === 0) return alert("Items required for inventory movement.");
    if (!isStockTransaction && totalAmount <= 0) return alert("Amount must be greater than zero.");

    if (txId) {
      const oldTx = state.transactions.find(t => t.id === txId);
      if (oldTx) executeReversal(oldTx);
    }

    const processedItems = isStockTransaction ? lineItems.map(li => ({
      ...li, selectedImeis: ['purchase', 'sale_return'].includes(txType) ? (imeiDataMap[li.lineId] || []).map(u => u.imei) : li.selectedImeis
    })) : [];

    let finalBillNumber = billNumber;
    if (!finalBillNumber && isStockTransaction) {
      const prefix = isVatExempt || !state.settings.vatEnabled ? 'NONVAT' : 'VAT';
      const typePrefix = txType === 'sale' ? 'SL' : txType === 'purchase' ? 'PR' : txType === 'sale_return' ? 'SR' : 'PRR';
      const existing = state.transactions.filter(t => t.type === txType && !!t.isVatExempt === isVatExempt && t.billNumber?.startsWith(`${prefix}-${typePrefix}-`));
      let maxNum = 0;
      existing.forEach(t => {
        const parts = t.billNumber!.split('-');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
      finalBillNumber = `${prefix}-${typePrefix}-${String(maxNum + 1).padStart(4, '0')}`;
    }

    const transaction: Transaction = {
      id: txId || crypto.randomUUID(), billNumber: finalBillNumber, date: txDate, time: new Date().toLocaleTimeString(),
      partyId: partyId || undefined, locationId: 'default', items: processedItems,
      totalAmount, taxableAmount: subTotal, vatAmount, isVatExempt, type: txType, paymentMethod, 
      receivedDenominations: isCashPayment ? receivedDenoms : undefined,
      returnedDenominations: isCashPayment ? returnedDenoms : undefined,
      description: description || `${txType.toUpperCase()} Record`,
      createdBy: activeUser.name
    };

    setState(prev => {
      let updatedInventory = [...prev.inventory];
      let updatedParties = [...prev.parties];
      let updatedVault = { ...prev.cashVault };

      if (isStockTransaction) {
        processedItems.forEach(li => {
          let invIdx = updatedInventory.findIndex(i => i.id === li.itemId || i.sku === li.sku);
          if (invIdx === -1) {
             const newItem: InventoryItem = {
               id: crypto.randomUUID(), sku: li.sku, name: li.name, category: 'General', quantity: 0, minStockLevel: 5,
               imeis: [], units: [], purchaseDate: txDate, purchasePrice: li.price, salePrice: li.price * 1.1, partyName: 'Quick Add',
               isIMEIBased: li.isIMEIBased, locationId: 'default', createdBy: activeUser.name
             };
             updatedInventory.push(newItem);
             invIdx = updatedInventory.length - 1;
          }
          const invItem = { ...updatedInventory[invIdx] };
          if (txType === 'sale' || txType === 'purchase_return') {
            invItem.quantity -= li.quantity;
            if (li.isIMEIBased && li.selectedImeis) {
              invItem.imeis = invItem.imeis.filter(i => !li.selectedImeis!.includes(i));
              invItem.units = (invItem.units || []).filter(u => !li.selectedImeis!.includes(u.imei));
            }
          } else if (txType === 'purchase' || txType === 'sale_return') {
            invItem.quantity += li.quantity;
            if (li.isIMEIBased) {
              const newUnits: IMEIUnit[] = (imeiDataMap[li.lineId] || []).map(u => ({ imei: u.imei, purchasePrice: u.price, salePrice: u.price * 1.1 }));
              invItem.imeis = [...invItem.imeis, ...newUnits.map(u => u.imei)];
              invItem.units = [...(invItem.units || []), ...newUnits];
              invItem.purchasePrice = newUnits[0].purchasePrice; 
            } else {
              invItem.purchasePrice = li.price; 
            }
          }
          updatedInventory[invIdx] = invItem;
        });
      }

      if (isCashPayment) {
        (Object.entries(receivedDenoms) as [string, number][]).forEach(([val, qty]) => {
          updatedVault[Number(val)] += qty;
        });
        (Object.entries(returnedDenoms) as [string, number][]).forEach(([val, qty]) => {
          updatedVault[Number(val)] -= qty;
        });
      }

      // AUTO-BALANCE LOGIC AS REQUESTED
      if (partyId) {
        const partyIdx = updatedParties.findIndex(p => p.id === partyId);
        if (partyIdx > -1) {
          const party = { ...updatedParties[partyIdx] };
          
          // AUTO-BALANCE LOGIC AS REQUESTED
          if (txType === 'sale') {
            if (paymentMethod === 'Credit') party.balance += totalAmount;
          } else if (txType === 'purchase') {
            if (paymentMethod === 'Credit') party.balance -= totalAmount;
          } else if (txType === 'sale_return') {
            if (paymentMethod === 'Credit') party.balance -= totalAmount;
          } else if (txType === 'purchase_return') {
            if (paymentMethod === 'Credit') party.balance += totalAmount;
          } else if (txType === 'receipt') {
            party.balance -= totalAmount;
          } else if (txType === 'payment') {
            party.balance += totalAmount;
          } else if (txType === 'income') {
            party.balance -= totalAmount;
          } else if (txType === 'expense') {
            party.balance += totalAmount;
          }
          updatedParties[partyIdx] = party;
        }
      }

      // TREASURY AUTO-BALANCE
      if (paymentMethod !== 'Credit') {
        const treasuryIdx = updatedParties.findIndex(p => p.id === paymentMethod);
        if (treasuryIdx > -1) {
          const treasury = { ...updatedParties[treasuryIdx] };
          if (['sale', 'income', 'receipt', 'purchase_return'].includes(txType)) {
             treasury.balance += totalAmount;
          } else {
             treasury.balance -= totalAmount;
          }
          updatedParties[treasuryIdx] = treasury;
        }
      }

      return { ...prev, inventory: updatedInventory, parties: updatedParties, cashVault: updatedVault, transactions: [transaction, ...prev.transactions] };
    });

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setTxId(null); setBillNumber(''); setTxType('sale'); setTxDate(getCurrentDateStr()); setPartyId(''); setLineItems([]); setPaymentMethod('treasury-cash'); 
    setDescription(''); setImeiDataMap({}); setDirectAmount(0); setIsVatExempt(false);
    setManualTaxable(null); setManualTotal(null);
    setReceivedDenoms({ 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
    setReturnedDenoms({ 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
    setCashTab('received');
  };

  const onPinVerified = () => {
    if (!pendingAction) return;
    const { type, targetTx } = pendingAction;
    if (type === 'delete') {
      executeReversal(targetTx);
      setIsPinModalOpen(false); setPendingAction(null);
    } else if (type === 'edit') {
      handleEdit(targetTx);
    }
  };

  const handleEdit = (targetTx: Transaction) => {
    setTxId(targetTx.id); setBillNumber(targetTx.billNumber || ''); setTxType(targetTx.type as any); setTxDate(targetTx.date); setPartyId(targetTx.partyId || ''); 
    setLineItems(targetTx.items || []); setPaymentMethod(targetTx.paymentMethod); setDescription(targetTx.description);
    setDirectAmount(targetTx.items?.length === 0 ? targetTx.totalAmount : 0);
    setIsVatExempt(targetTx.isVatExempt || false);
    setManualTaxable(targetTx.taxableAmount || null);
    setManualTotal(targetTx.totalAmount || null);
    setReceivedDenoms(targetTx.receivedDenominations || { 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
    setReturnedDenoms(targetTx.returnedDenominations || { 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
    
    if (['sale', 'purchase', 'sale_return', 'purchase_return'].includes(targetTx.type) && targetTx.items) {
      const newImeiMap: Record<string, { imei: string, price: number }[]> = {};
      targetTx.items.forEach(li => {
        if (li.isIMEIBased && li.selectedImeis) {
          newImeiMap[li.lineId] = li.selectedImeis.map(imei => ({ imei, price: li.price }));
        }
      });
      setImeiDataMap(newImeiMap);
    } else {
      setImeiDataMap({});
    }

    setIsModalOpen(true); setIsPinModalOpen(false); setPendingAction(null);
  };

  const triggerAction = (type: 'edit' | 'delete', targetTx: Transaction) => {
    setPendingAction({ type, targetTx });
    if (superAdminSession) {
      if (type === 'delete') {
        executeReversal(targetTx);
      } else {
        handleEdit(targetTx);
      }
    } else {
      setIsPinModalOpen(true);
    }
  };

  const treasuryAccounts = state.parties.filter(p => p.type === 'treasury');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-black text-slate-900 uppercase">Registry</h1><p className="text-slate-500 font-bold uppercase text-[9px] mt-2 tracking-widest">Digital Audit Log</p></div>
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-700 flex items-center gap-2"><Plus size={16}/> New Entry</button>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border flex gap-4"><Search className="text-slate-400" size={20} /><input type="text" placeholder="Lookup logs..." className="bg-transparent outline-none font-bold flex-1 text-sm uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr><th className="px-8 py-6">Descriptor</th><th className="px-8 py-6">Bill No</th><th className="px-8 py-6">Type</th><th className="px-8 py-6">Account</th><th className="px-8 py-6 text-right">Value</th><th className="px-8 py-6 text-center">Audit</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.transactions.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase())).map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-6"><p className="font-black text-slate-900 text-sm uppercase leading-none">{tx.description}</p><p className="text-[9px] text-slate-400 font-black uppercase mt-1">{formatAppDate(tx.date, state.settings.dateSystem)} • {tx.time}</p></td>
                  <td className="px-8 py-6 font-black text-slate-900 text-xs uppercase">{tx.billNumber || '-'}</td>
                  <td className="px-8 py-6"><span className={`px-3 py-1 rounded-xl text-[8px] font-black uppercase border ${['sale', 'receipt', 'income'].includes(tx.type) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : tx.type === 'transfer' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{tx.type}</span></td>
                  <td className="px-8 py-6 font-black text-slate-900 uppercase text-xs">{tx.partyId ? state.parties.find(p => p.id === tx.partyId)?.name : tx.fromPartyId ? `${state.parties.find(p=>p.id===tx.fromPartyId)?.name} ➔ ${state.parties.find(p=>p.id===tx.toPartyId)?.name}` : 'DIRECT ENTRY'}</td>
                  <td className="px-8 py-6 text-right font-black text-slate-900 text-lg tracking-tighter">{state.settings.currency} {tx.totalAmount.toLocaleString()}</td>
                  <td className="px-8 py-6 text-center"><div className="flex justify-center gap-2">
                    {['sale', 'purchase', 'sale_return', 'purchase_return'].includes(tx.type) && (
                      <button onClick={() => setSelectedBillTx(tx)} className="p-2.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl"><Printer size={16}/></button>
                    )}
                    <button onClick={() => triggerAction('edit', tx)} className="p-2.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl"><Edit2 size={16}/></button>
                    <button onClick={() => triggerAction('delete', tx)} className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={16}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-7xl h-[96vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 border border-white/20">
            <div className="px-10 py-6 border-b bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><Receipt size={28}/></div>
                <div><h2 className="text-xl font-black uppercase leading-none">{txId ? 'Edit Journal Record' : 'Post Transaction'}</h2><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5">Dynamic Treasury-Linked Console</p></div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-4xl text-slate-400 hover:text-white transition-all">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-white">
              <div className="flex-1 p-10 overflow-y-auto space-y-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  {/* LEFT: Context & Ledger */}
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={16}/> Business Flow</h3>
                      <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded-3xl border shadow-inner">
                        {(['sale', 'purchase', 'receipt', 'payment', 'expense', 'income', 'sale_return', 'purchase_return'] as const).map(type => (
                          <button key={type} type="button" onClick={() => { setTxType(type); setLineItems([]); setDirectAmount(0); }} className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${txType === type ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}>{type.replace('_', ' ')}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Ledger Account {isDirectEntry && '(Optional)'}</label>
                        <select required={!isDirectEntry} className="w-full px-6 py-5 bg-slate-50 border rounded-[2rem] font-black text-sm uppercase outline-none focus:border-blue-600 shadow-inner" value={partyId} onChange={e => setPartyId(e.target.value)}>
                          <option value="">{isDirectEntry ? 'DIRECT FINANCIAL ENTRY' : 'Pick Account...'}</option>
                          {state.parties.filter(p => p.type !== 'treasury').map(p => (<option key={p.id} value={p.id}>{p.name} ({p.type})</option>))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Payment Route</label>
                           <select className="w-full px-6 py-5 bg-slate-50 border rounded-[2rem] font-black text-sm uppercase outline-none focus:border-blue-600 shadow-inner" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                             <option value="Credit">Credit Line</option>
                             {treasuryAccounts.map(acc => (
                               <option key={acc.id} value={acc.id}>{acc.name}</option>
                             ))}
                           </select>
                        </div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Entry Date</label><input type="date" required className="w-full px-6 py-5 bg-slate-50 border rounded-[2rem] font-black text-sm outline-none focus:border-blue-600 shadow-inner" value={txDate} onChange={e => setTxDate(e.target.value)} /></div>
                      </div>
                      {isStockTransaction && (
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Bill / Invoice Number (Optional)</label>
                          <input type="text" className="w-full px-6 py-5 bg-slate-50 border rounded-[2rem] font-black text-sm uppercase outline-none focus:border-blue-600 shadow-inner" placeholder="Auto-generated if left blank" value={billNumber} onChange={e => setBillNumber(e.target.value)} />
                        </div>
                      )}
                      {state.settings.vatEnabled && isStockTransaction && (
                        <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                          <div>
                            <p className="font-black text-slate-900 uppercase text-xs">VAT Exempt</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exclude VAT from this transaction</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={isVatExempt} onChange={e => setIsVatExempt(e.target.checked)} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      )}
                    </div>
                    {!isStockTransaction && (
                      <div className="bg-blue-600 p-8 rounded-[3rem] text-white shadow-2xl animate-in slide-in-from-left duration-300">
                        <label className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-4 block text-center">Net Impact Value</label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={32}/>
                          <input type="number" required autoFocus className="w-full bg-white/10 border-2 border-white/20 rounded-[2rem] py-6 px-12 text-center text-5xl font-black outline-none placeholder:text-white/20 focus:bg-white/20 transition-all" placeholder="0.00" value={directAmount || ''} onChange={e => setDirectAmount(parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MIDDLE: Stock Items OR Cash Denominations */}
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    {isStockTransaction ? (
                      <div className="space-y-6 flex-1 flex flex-col min-h-[400px]">
                         <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={16}/> Item Ledger</h3>
                            <div className="relative group">
                               <button type="button" onClick={() => setIsItemPickerOpen(true)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"><Plus size={14}/> Add Asset</button>
                               {isItemPickerOpen && (
                                 <div className="absolute right-0 top-12 z-[100] w-96 bg-white border-2 border-slate-900 rounded-[2.5rem] shadow-2xl p-6 animate-in zoom-in duration-200">
                                    <input autoFocus className="w-full px-6 py-4 bg-slate-50 border rounded-2xl text-[10px] font-black uppercase outline-none mb-4" placeholder="SKU or Model..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                                    <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                                       {state.inventory.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()) || i.sku.toLowerCase().includes(itemSearch.toLowerCase())).map(item => (
                                         <button key={item.id} type="button" onClick={() => handleAddLine(item)} className="w-full flex items-center justify-between p-4 hover:bg-blue-50 rounded-2xl text-left transition-all"><p className="text-[10px] font-black text-slate-900 uppercase leading-none">{item.name}</p><Plus size={16} className="text-slate-300"/></button>
                                       ))}
                                    </div>
                                 </div>
                               )}
                            </div>
                         </div>
                         <div className="flex-1 border border-slate-100 rounded-[3rem] overflow-hidden bg-slate-50/20 shadow-inner">
                            <table className="w-full text-left">
                               <thead className="bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b">
                                  <tr><th className="px-8 py-5">Particulars</th><th className="px-8 py-5 text-center">Qty</th><th className="px-8 py-5 text-right">Rate</th><th className="px-8 py-5 text-right">Discount</th><th className="px-8 py-5 text-center">#</th></tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                  {lineItems.map(li => (
                                    <React.Fragment key={li.lineId}>
                                       <tr className="bg-white hover:bg-slate-50/50">
                                          <td className="px-8 py-5"><p className="text-[11px] font-black text-slate-900 uppercase leading-none">{li.name}</p></td>
                                          <td className="px-8 py-5 text-center">
                                             <div className="flex items-center justify-center gap-3 bg-slate-100 rounded-2xl p-1 shadow-inner">
                                                <button type="button" onClick={() => updateLineQty(li.lineId, li.quantity - 1)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-xl"><Minus size={14}/></button>
                                                <span className="font-black text-sm w-8 text-center">{li.quantity}</span>
                                                <button type="button" onClick={() => updateLineQty(li.lineId, li.quantity + 1)} className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-white rounded-xl"><Plus size={14}/></button>
                                             </div>
                                          </td>
                                          <td className="px-8 py-5 text-right">
                                             <input type="number" className="w-24 text-right bg-slate-50 border rounded-xl px-4 py-2 font-black text-sm outline-none" value={li.price} onChange={e => { setManualTaxable(null); setManualTotal(null); setLineItems(prev => prev.map(p => p.lineId === li.lineId ? { ...p, price: parseFloat(e.target.value) || 0 } : p)); }} />
                                          </td>
                                          <td className="px-8 py-5 text-right">
                                             <div className="flex items-center justify-end gap-1">
                                                <input type="number" className="w-16 text-right bg-slate-50 border rounded-xl px-2 py-2 font-black text-sm outline-none" value={li.discountValue || ''} onChange={e => { setManualTaxable(null); setManualTotal(null); setLineItems(prev => prev.map(p => p.lineId === li.lineId ? { ...p, discountValue: parseFloat(e.target.value) || 0 } : p)); }} placeholder="0" />
                                                <select className="bg-slate-50 border rounded-xl px-2 py-2 font-black text-xs outline-none" value={li.discountType || 'fixed'} onChange={e => { setManualTaxable(null); setManualTotal(null); setLineItems(prev => prev.map(p => p.lineId === li.lineId ? { ...p, discountType: e.target.value as any } : p)); }}>
                                                  <option value="fixed">{state.settings.currency}</option>
                                                  <option value="percentage">%</option>
                                                </select>
                                             </div>
                                          </td>
                                          <td className="px-8 py-5 text-center"><button type="button" onClick={() => removeLine(li.lineId)} className="text-slate-200 hover:text-red-500"><Trash2 size={20}/></button></td>
                                       </tr>
                                       {li.isIMEIBased && (
                                         <tr className="bg-slate-50/30">
                                           <td colSpan={4} className="px-10 py-6 border-b border-indigo-50/20">
                                              <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Layers size={14}/> Serial Numbers ({li.quantity})</h4>
                                              </div>
                                              <div className="space-y-2">
                                                 {Array.from({ length: li.quantity }).map((_, idx) => (
                                                   <div key={idx} className="flex gap-3">
                                                      {txType === 'sale' || txType === 'purchase_return' ? (
                                                        <select className="flex-1 px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl font-mono text-[10px] font-black uppercase outline-none focus:border-indigo-600" value={li.selectedImeis?.[idx] || ''} onChange={e => setImeiAtSlot(li.lineId, idx, e.target.value)}>
                                                          <option value="">PICK UNIT...</option>
                                                          {Array.from(new Set([
                                                            ...(state.inventory.find(i => i.id === li.itemId || i.sku === li.sku)?.imeis || []),
                                                            ...(li.selectedImeis || []).filter(Boolean)
                                                          ])).map(imei => (<option key={imei} value={imei}>{imei}</option>))}
                                                        </select>
                                                      ) : (
                                                        <div className="flex flex-1 gap-2">
                                                           <input className="flex-1 px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl font-mono text-[10px] font-black uppercase outline-none focus:border-indigo-600 shadow-sm" placeholder="SERIAL / IMEI..." value={imeiDataMap[li.lineId]?.[idx]?.imei || ''} onChange={e => setImeiAtSlot(li.lineId, idx, e.target.value)} />
                                                           <input type="number" className="w-32 px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl font-black text-[10px] outline-none focus:border-indigo-600 shadow-sm" placeholder="COST" value={imeiDataMap[li.lineId]?.[idx]?.price || ''} onChange={e => {
                                                             const units = [...(imeiDataMap[li.lineId] || [])];
                                                             if (units[idx]) units[idx].price = parseFloat(e.target.value) || 0;
                                                             setImeiDataMap({ ...imeiDataMap, [li.lineId]: units });
                                                           }} />
                                                        </div>
                                                      )}
                                                   </div>
                                                 ))}
                                              </div>
                                           </td>
                                         </tr>
                                       )}
                                    </React.Fragment>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-center items-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[4rem] text-center space-y-4 animate-in fade-in duration-700">
                         <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-4"><Receipt size={48} className="text-slate-300"/></div>
                         <h2 className="text-2xl font-black text-slate-400 uppercase tracking-tighter">Financial Entry Mode</h2>
                         <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest max-w-xs">Modular Treasury Protocol</p>
                      </div>
                    )}

                    {isCashPayment && (
                      <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl animate-in slide-in-from-bottom duration-500">
                        <div className="flex items-center justify-between mb-8">
                           <div className="flex gap-4">
                              <button type="button" onClick={() => setCashTab('received')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${cashTab === 'received' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>Cash Received</button>
                              <button type="button" onClick={() => setCashTab('returned')} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${cashTab === 'returned' ? 'bg-red-500 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>Cash Returned</button>
                           </div>
                           <div className={`px-6 py-3 rounded-2xl font-black text-sm tracking-tighter flex items-center gap-4 ${cashNetImpact === requiredCashNet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              <span className="text-[10px] uppercase text-slate-500">Net Impact:</span>
                              Σ {cashNetImpact.toLocaleString()} / {requiredCashNet.toLocaleString()}
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                           {(Object.entries(cashTab === 'received' ? receivedDenoms : returnedDenoms) as [string, number][]).sort((a,b) => Number(b[0]) - Number(a[0])).map(([note, qty]) => (
                             <div key={note} className="space-y-2 group">
                                <div className="flex justify-between items-center px-3 mb-1">
                                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{note}</label>
                                   <span className={`text-[9px] font-black ${cashTab === 'received' ? 'text-emerald-400' : 'text-red-400'}`}>{(Number(note) * qty).toLocaleString()}</span>
                                </div>
                                <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 focus-within:border-indigo-500 transition-all">
                                   <button type="button" onClick={() => updateDenom(cashTab, Number(note), qty - 1)} className="p-3 hover:bg-white/10 rounded-xl transition-colors"><Minus size={12}/></button>
                                   <input type="number" className="w-full bg-transparent text-center font-black text-lg outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={qty || ''} onChange={e => updateDenom(cashTab, Number(note), parseInt(e.target.value) || 0)} />
                                   <button type="button" onClick={() => updateDenom(cashTab, Number(note), qty + 1)} className="p-3 hover:bg-white/10 rounded-xl transition-colors"><Plus size={12}/></button>
                                </div>
                             </div>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4"><h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Registry Remarks</h3><textarea className="w-full px-8 py-5 bg-slate-50 border rounded-[2rem] outline-none font-black text-xs uppercase h-24 shadow-inner focus:border-indigo-600 transition-all" placeholder="..." value={description} onChange={e => setDescription(e.target.value)} /></div>
              </div>

              <div className="px-6 md:px-10 py-6 md:py-10 bg-slate-50 border-t flex flex-col md:flex-row items-center justify-between gap-6 flex-shrink-0">
                <div className="w-full md:w-auto bg-white px-6 md:px-10 py-4 md:py-5 rounded-[2rem] md:rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex items-center justify-between md:justify-start gap-6 md:gap-10">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg ${['sale', 'receipt', 'income'].includes(txType) ? 'bg-emerald-50' : 'bg-red-50'}`}>
                       {['sale', 'receipt', 'income'].includes(txType) ? <ArrowUpCircle className="text-emerald-500" size={20}/> : <ArrowDownCircle className="text-red-500" size={20}/>}
                    </div>
                    <div>
                       <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Impact Value</p>
                       {isStockTransaction ? (
                         <div className="flex items-center gap-2">
                           <span className="text-2xl md:text-4xl font-black text-slate-900 leading-none tracking-tighter">{state.settings.currency}</span>
                           <input type="number" className="w-32 md:w-48 text-2xl md:text-4xl font-black text-slate-900 leading-none tracking-tighter bg-transparent outline-none border-b-2 border-transparent focus:border-blue-500" value={manualTotal !== null ? manualTotal : totalAmount} onChange={e => { setManualTotal(parseFloat(e.target.value) || 0); setManualTaxable(null); }} placeholder="0.00" />
                         </div>
                       ) : (
                         <p className="text-2xl md:text-4xl font-black text-slate-900 leading-none tracking-tighter">{state.settings.currency} {totalAmount.toLocaleString()}</p>
                       )}
                    </div>
                  </div>
                  {state.settings.vatEnabled && isStockTransaction && !isVatExempt && (
                    <div className="flex gap-6 border-l-2 border-slate-100 pl-6 ml-2">
                      <div>
                        <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Taxable Amount</p>
                        <div className="flex items-center gap-2">
                           <span className="text-lg md:text-xl font-black text-slate-700 leading-none tracking-tighter">{state.settings.currency}</span>
                           <input type="number" className="w-24 md:w-32 text-lg md:text-xl font-black text-slate-700 leading-none tracking-tighter bg-transparent outline-none border-b-2 border-transparent focus:border-blue-500" value={manualTaxable !== null ? manualTaxable : subTotal} onChange={e => { setManualTaxable(parseFloat(e.target.value) || 0); setManualTotal(null); }} placeholder="0.00" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">VAT ({state.settings.vatRate}%)</p>
                        <p className="text-lg md:text-xl font-black text-slate-700 leading-none tracking-tighter">{state.settings.currency} {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={isCashPayment && cashNetImpact !== (['sale', 'income', 'receipt'].includes(txType) ? totalAmount : -totalAmount)} className="w-full md:w-auto px-10 md:px-20 py-5 md:py-8 bg-slate-900 text-white font-black rounded-2xl md:rounded-full uppercase tracking-widest text-[10px] md:text-xs shadow-2xl hover:bg-blue-600 hover:scale-105 transform transition-all flex items-center justify-center gap-4 disabled:opacity-30">Authorize Registry <CircleCheckBig size={24}/></button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <PinModal isOpen={isPinModalOpen} onClose={() => { setIsPinModalOpen(false); setPendingAction(null); }} onSuccess={onPinVerified} correctPin={state.settings.securityPin} />

      {selectedBillTx && (
        <BillModal transaction={selectedBillTx} state={state} onClose={() => setSelectedBillTx(null)} />
      )}
    </div>
  );
};

export default Transactions;
