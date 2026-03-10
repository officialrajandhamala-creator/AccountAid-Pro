import React, { useState, useMemo, useEffect } from 'react';
import { AppState, Transaction, Party, InventoryItem } from '../types';
import { downloadCSV } from '../utils/exportUtils';
import { formatAppDate } from '../utils/dateUtils';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface ReportsProps {
  state: AppState;
}

export default function Reports({ state }: ReportsProps) {
  const [activeSection, setActiveSection] = useState('ledger-master');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalData, setModalData] = useState<{ title: string; transactions: Transaction[] } | null>(null);
  const [imeiModalData, setImeiModalData] = useState<{ item: InventoryItem; history: any[] } | null>(null);
  const [voucherModalData, setVoucherModalData] = useState<Transaction | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (voucherModalData) {
          setVoucherModalData(null);
        } else {
          setModalData(null);
          setImeiModalData(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voucherModalData]);

  const openItemDetail = (item: InventoryItem) => {
    if (item.isIMEIBased) {
      const imeiMap: Record<string, any> = {};
      
      // Initialize with current stock
      item.imeis.forEach(imei => {
        imeiMap[imei] = { 
          imei, 
          status: 'In Stock', 
          entryDate: item.purchaseDate || 'Opening', 
          supplier: item.partyName || 'Opening Stock', 
          exitDate: '-', 
          customer: '-',
          saleAmount: '-'
        };
      });

      // Process all transactions to build history
      const sortedTx = [...state.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedTx.forEach(tx => {
        if (!tx.items) return;
        const party = state.parties.find(p => p.id === tx.partyId)?.name || 'Unknown';
        
        tx.items.forEach(li => {
          if ((li.itemId === item.id || li.sku === item.sku) && li.selectedImeis) {
            li.selectedImeis.forEach(imei => {
              if (!imeiMap[imei]) {
                imeiMap[imei] = { imei, status: 'Unknown', entryDate: '-', supplier: '-', exitDate: '-', customer: '-', saleAmount: '-' };
              }
              
              if (tx.type === 'purchase') {
                imeiMap[imei].entryDate = tx.date;
                imeiMap[imei].supplier = party;
                imeiMap[imei].status = 'In Stock';
              } else if (tx.type === 'sale') {
                imeiMap[imei].exitDate = tx.date;
                imeiMap[imei].customer = party;
                imeiMap[imei].status = 'Sold Out';
                imeiMap[imei].saleAmount = li.price;
              } else if (tx.type === 'purchase_return') {
                imeiMap[imei].exitDate = tx.date;
                imeiMap[imei].customer = `Return to ${party}`;
                imeiMap[imei].status = 'Sold Out';
                imeiMap[imei].saleAmount = '-';
              } else if (tx.type === 'sale_return') {
                imeiMap[imei].entryDate = tx.date;
                imeiMap[imei].supplier = `Return from ${party}`;
                imeiMap[imei].status = 'In Stock';
                imeiMap[imei].saleAmount = '-';
              }
            });
          }
        });
      });

      // Ensure current stock items are marked as In Stock and others as Sold Out
      Object.keys(imeiMap).forEach(imei => {
        if (item.imeis.includes(imei)) {
          imeiMap[imei].status = 'In Stock';
        } else {
          imeiMap[imei].status = 'Sold Out';
        }
      });

      setImeiModalData({ item, history: Object.values(imeiMap) });
    } else {
      const itemTx = state.transactions.filter(t => t.items?.some(li => li.itemId === item.id || li.sku === item.sku));
      setModalData({ title: `${item.name} (Bulk Ledger)`, transactions: itemTx });
    }
  };

  const accountingData = useMemo(() => {
    const sales = state.transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.totalAmount, 0);
    const purchases = state.transactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + t.totalAmount, 0);
    const salesReturn = state.transactions.filter(t => t.type === 'sale_return').reduce((sum, t) => sum + t.totalAmount, 0);
    const purchasesReturn = state.transactions.filter(t => t.type === 'purchase_return').reduce((sum, t) => sum + t.totalAmount, 0);
    const expenses = state.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.totalAmount, 0);
    const incomes = state.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.totalAmount, 0);

    let openingStockValue = 0;
    let closingStockValue = 0;
    state.inventory.forEach(item => {
      let purchaseQty = 0;
      let saleQty = 0;
      let purchaseReturnQty = 0;
      let saleReturnQty = 0;
      state.transactions.forEach(tx => {
        if (tx.items) {
          tx.items.forEach(li => {
            if (li.itemId === item.id || li.sku === item.sku) {
              if (tx.type === 'purchase') purchaseQty += li.quantity;
              if (tx.type === 'sale') saleQty += li.quantity;
              if (tx.type === 'purchase_return') purchaseReturnQty += li.quantity;
              if (tx.type === 'sale_return') saleReturnQty += li.quantity;
            }
          });
        }
      });
      const netPurchase = purchaseQty - purchaseReturnQty;
      const netSale = saleQty - saleReturnQty;
      const openingStock = item.quantity + netSale - netPurchase;
      openingStockValue += openingStock * item.purchasePrice;
      closingStockValue += item.quantity * item.purchasePrice;
    });

    const netSales = sales - salesReturn;
    const netPurchases = purchases - purchasesReturn;
    const grossProfit = netSales - netPurchases + closingStockValue - openingStockValue;
    const netProfit = grossProfit - expenses + incomes;

    let partyDr = 0;
    let partyCr = 0;
    state.parties.forEach(p => {
      if (p.balance > 0) partyDr += p.balance;
      else partyCr += Math.abs(p.balance);
    });

    const trialDr = partyDr + purchases + salesReturn + expenses + openingStockValue;
    const trialCr = partyCr + sales + purchasesReturn + incomes;
    const suspenseDiff = trialDr - trialCr;

    return {
      sales, purchases, salesReturn, purchasesReturn, expenses, incomes,
      openingStockValue, closingStockValue, netSales, netPurchases,
      grossProfit, netProfit, trialDr, trialCr, suspenseDiff
    };
  }, [state.transactions, state.inventory, state.parties]);

  const handlePrint = async () => {
    const printerType = state.settings.printerType;
    
    if (!printerType) {
      alert("Printer Configuration Missing: Please set up a default printer in the Settings module before printing.");
      return;
    }

    if (printerType === 'pdf') {
      try {
        const element = document.querySelector('.content') as HTMLElement;
        if (!element) return;
        
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        
        const opt = {
          margin:       0.5,
          filename:     `Report_${activeSection}_${dateStr}.pdf`,
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

  const handleExportExcel = () => {
    const table = document.querySelector('.content table') as HTMLTableElement;
    if (!table) return alert("No data to export!");

    const rows = Array.from(table.querySelectorAll('tr'));
    const csvData = rows.map(row => {
      const cols = Array.from(row.querySelectorAll('th, td'));
      return cols.map(col => `"${col.textContent?.replace(/"/g, '""') || ''}"`).join(',');
    }).join('\n');

    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Report_${activeSection}_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'ledger-master':
        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Ledger Name</th><th>Group</th><th className="amt">Balance</th><th>Actions</th></tr></thead>
              <tbody>
                {state.parties.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                  <tr key={p.id}>
                    <td><span className="drill-down" onClick={() => openDetail(p.name, p.id)}>{p.name}</span></td>
                    <td className="capitalize">{p.type.replace('_', ' ')}</td>
                    <td className="amt">{Math.abs(p.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.balance >= 0 ? 'Dr' : 'Cr'}</td>
                    <td>-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'account-groups': {
        const groups = state.parties.reduce((acc, p) => {
          acc[p.type] = (acc[p.type] || 0) + p.balance;
          return acc;
        }, {} as Record<string, number>);
        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Account Group</th><th className="amt">Total Balance</th></tr></thead>
              <tbody>
                {Object.entries(groups).map(([type, bal]) => (
                  <tr key={type}>
                    <td className="capitalize">{type.replace('_', ' ')}</td>
                    <td className="amt">{Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {bal >= 0 ? 'Dr' : 'Cr'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'rate-discount':
        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Item Name</th><th>SKU</th><th className="amt">Purchase Price</th><th className="amt">Sale Price</th></tr></thead>
              <tbody>
                {state.inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td className="amt">{item.purchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="amt">{item.salePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'cash-bank': {
        const cashBankParties = state.parties.filter(p => p.type === 'treasury');
        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Account Name</th><th className="amt">Current Balance</th></tr></thead>
              <tbody>
                {cashBankParties.map(p => (
                  <tr key={p.id}>
                    <td><span className="drill-down" onClick={() => openDetail(p.name, p.id)}>{p.name}</span></td>
                    <td className="amt">{Math.abs(p.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.balance >= 0 ? 'Dr' : 'Cr'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'purchase-reg': {
        const purchases = state.transactions.filter(t => t.type === 'purchase' && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Date</th><th>Bill No</th><th>Supplier</th><th className="amt">Taxable</th><th className="amt">VAT</th><th className="amt">Total Amount</th><th>Action</th></tr></thead>
              <tbody>
                {purchases.map(t => {
                  const party = state.parties.find(p => p.id === t.partyId);
                  return (
                    <tr key={t.id}>
                      <td>{formatAppDate(t.date, state.settings.dateSystem)}</td>
                      <td>{t.billNumber || t.id.substring(0, 8)}</td>
                      <td>{party?.name || 'Unknown'}</td>
                      <td className="amt">{(t.taxableAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="amt">{(t.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="amt">{t.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td><button onClick={() => setVoucherModalData(t)} className="text-blue-600 underline cursor-pointer">View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      case 'sale-reg': {
        const sales = state.transactions.filter(t => t.type === 'sale' && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Date</th><th>Bill No</th><th>Customer</th><th className="amt">Taxable</th><th className="amt">VAT</th><th className="amt">Total Amount</th><th>Action</th></tr></thead>
              <tbody>
                {sales.map(t => {
                  const party = state.parties.find(p => p.id === t.partyId);
                  return (
                    <tr key={t.id}>
                      <td>{formatAppDate(t.date, state.settings.dateSystem)}</td>
                      <td>{t.billNumber || t.id.substring(0, 8)}</td>
                      <td>{party?.name || 'Unknown'}</td>
                      <td className="amt">{(t.taxableAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="amt">{(t.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="amt">{t.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td><button onClick={() => setVoucherModalData(t)} className="text-blue-600 underline cursor-pointer">View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      case 'pl': {
        const {
          sales, purchases, salesReturn, purchasesReturn, expenses, incomes,
          openingStockValue, closingStockValue, netSales, netPurchases,
          grossProfit, netProfit
        } = accountingData;

        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Particulars</th><th className="amt">Debit</th><th>Particulars</th><th className="amt">Credit</th></tr></thead>
              <tbody>
                <tr><td>Opening Stock</td><td className="amt">{openingStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>Sales Accounts (Net)</td><td className="amt">{netSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                <tr><td>Purchase Accounts (Net)</td><td className="amt">{netPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>Closing Stock</td><td className="amt">{closingStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                <tr style={{ fontWeight: 'bold', background: '#eee' }}><td>Gross Profit</td><td className="amt">{grossProfit > 0 ? grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td><td>Gross Loss</td><td className="amt">{grossProfit < 0 ? Math.abs(grossProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td></tr>
                <tr><td>Direct & Indirect Expenses</td><td className="amt">{expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>Direct & Indirect Incomes</td><td className="amt">{incomes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                <tr style={{ fontWeight: 'bold', background: '#e0e0e0' }}><td>Net Profit</td><td className="amt">{netProfit > 0 ? netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td><td>Net Loss</td><td className="amt">{netProfit < 0 ? Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td></tr>
              </tbody>
            </table>
          </div>
        );
      }
      case 'bs': {
        const assets = state.parties.filter(p => ['treasury', 'customer', 'fixed_asset'].includes(p.type));
        const liabilities = state.parties.filter(p => ['supplier', 'liability', 'equity'].includes(p.type));
        
        let totalAssets = assets.reduce((sum, p) => sum + p.balance, 0);
        let totalLiabilities = liabilities.reduce((sum, p) => sum + p.balance, 0);

        totalAssets += accountingData.closingStockValue;
        
        // Net profit is a credit balance, so it should be negative (since liabilities are negative)
        totalLiabilities -= accountingData.netProfit; 

        // Suspense Account
        let suspenseDr = 0;
        let suspenseCr = 0;
        if (accountingData.suspenseDiff > 0) {
          suspenseCr = accountingData.suspenseDiff;
          totalLiabilities -= suspenseCr; // Add to liabilities (negative)
        } else if (accountingData.suspenseDiff < 0) {
          suspenseDr = Math.abs(accountingData.suspenseDiff);
          totalAssets += suspenseDr; // Add to assets (positive)
        }

        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Liabilities & Equity</th><th className="amt">Amount</th><th>Assets</th><th className="amt">Amount</th></tr></thead>
              <tbody>
                <tr>
                  <td style={{verticalAlign: 'top'}}>
                    {liabilities.map(p => <div key={p.id} style={{display: 'flex', justifyContent: 'space-between'}}><span>{p.name}</span> <span className="amt">{Math.abs(p.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>)}
                    <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Net Profit</span> <span className="amt">{accountingData.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    {suspenseCr > 0 && <div style={{display: 'flex', justifyContent: 'space-between', color: 'red'}}><span>Suspense Account</span> <span className="amt">{suspenseCr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>}
                  </td>
                  <td className="amt" style={{verticalAlign: 'bottom', fontWeight: 'bold'}}>{Math.abs(totalLiabilities).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{verticalAlign: 'top'}}>
                    {assets.map(p => <div key={p.id} style={{display: 'flex', justifyContent: 'space-between'}}><span>{p.name}</span> <span className="amt">{Math.abs(p.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>)}
                    <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Closing Stock</span> <span className="amt">{accountingData.closingStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    {suspenseDr > 0 && <div style={{display: 'flex', justifyContent: 'space-between', color: 'red'}}><span>Suspense Account</span> <span className="amt">{suspenseDr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>}
                  </td>
                  <td className="amt" style={{verticalAlign: 'bottom', fontWeight: 'bold'}}>{Math.abs(totalAssets).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }
      case 'trial-bal': {
        let totalDr = 0;
        let totalCr = 0;
        
        let suspenseDr = 0;
        let suspenseCr = 0;
        if (accountingData.suspenseDiff > 0) {
          suspenseCr = accountingData.suspenseDiff;
        } else if (accountingData.suspenseDiff < 0) {
          suspenseDr = Math.abs(accountingData.suspenseDiff);
        }

        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Particulars</th><th className="amt">Debit</th><th className="amt">Credit</th></tr></thead>
              <tbody>
                {state.parties.map(p => {
                  if (p.balance > 0) totalDr += p.balance;
                  else totalCr += Math.abs(p.balance);
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="amt">{p.balance > 0 ? p.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                      <td className="amt">{p.balance < 0 ? Math.abs(p.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td>Opening Stock</td>
                  <td className="amt">{accountingData.openingStockValue > 0 ? accountingData.openingStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  <td className="amt"></td>
                </tr>
                <tr>
                  <td>Purchase Accounts</td>
                  <td className="amt">{accountingData.purchases > 0 ? accountingData.purchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  <td className="amt"></td>
                </tr>
                <tr>
                  <td>Sales Return</td>
                  <td className="amt">{accountingData.salesReturn > 0 ? accountingData.salesReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  <td className="amt"></td>
                </tr>
                <tr>
                  <td>Direct & Indirect Expenses</td>
                  <td className="amt">{accountingData.expenses > 0 ? accountingData.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  <td className="amt"></td>
                </tr>
                <tr>
                  <td>Sales Accounts</td>
                  <td className="amt"></td>
                  <td className="amt">{accountingData.sales > 0 ? accountingData.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                </tr>
                <tr>
                  <td>Purchase Return</td>
                  <td className="amt"></td>
                  <td className="amt">{accountingData.purchasesReturn > 0 ? accountingData.purchasesReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                </tr>
                <tr>
                  <td>Direct & Indirect Incomes</td>
                  <td className="amt"></td>
                  <td className="amt">{accountingData.incomes > 0 ? accountingData.incomes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                </tr>
                {(suspenseDr > 0 || suspenseCr > 0) && (
                  <tr style={{ color: 'red' }}>
                    <td>Suspense Account (Adjustment)</td>
                    <td className="amt">{suspenseDr > 0 ? suspenseDr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                    <td className="amt">{suspenseCr > 0 ? suspenseCr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  </tr>
                )}
                <tr style={{ fontWeight: 'bold', background: '#eee' }}>
                  <td>Total</td>
                  <td className="amt">{(totalDr + accountingData.purchases + accountingData.salesReturn + accountingData.expenses + accountingData.openingStockValue + suspenseDr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="amt">{(totalCr + accountingData.sales + accountingData.purchasesReturn + accountingData.incomes + suspenseCr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }
      case 'stock-analysis': {
        const itemStats = state.inventory.map(item => {
          let purchaseQty = 0;
          let saleQty = 0;
          let purchaseReturnQty = 0;
          let saleReturnQty = 0;

          state.transactions.forEach(tx => {
            if (tx.items) {
              tx.items.forEach(li => {
                if (li.itemId === item.id || li.sku === item.sku) {
                  if (tx.type === 'purchase') purchaseQty += li.quantity;
                  if (tx.type === 'sale') saleQty += li.quantity;
                  if (tx.type === 'purchase_return') purchaseReturnQty += li.quantity;
                  if (tx.type === 'sale_return') saleReturnQty += li.quantity;
                }
              });
            }
          });

          const netPurchase = purchaseQty - purchaseReturnQty;
          const netSale = saleQty - saleReturnQty;
          const closingStock = item.quantity;
          const openingStock = closingStock + netSale - netPurchase;

          return {
            ...item,
            openingStock,
            netPurchase,
            netSale,
            closingStock
          };
        }).filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku.toLowerCase().includes(searchQuery.toLowerCase()));

        return (
          <div className="report-card active">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>SKU</th>
                  <th className="amt">Opening Stock</th>
                  <th className="amt">Item In (Purchase)</th>
                  <th className="amt">Item Out (Sales)</th>
                  <th className="amt">Closing Stock</th>
                </tr>
              </thead>
              <tbody>
                {itemStats.map(item => (
                  <tr key={item.id}>
                    <td><span className="drill-down" onClick={() => openItemDetail(item)}>{item.name}</span></td>
                    <td>{item.sku}</td>
                    <td className="amt">{item.openingStock}</td>
                    <td className="amt">{item.netPurchase}</td>
                    <td className="amt">{item.netSale}</td>
                    <td className="amt">{item.closingStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'curr-stock':
      case 'stock-valuation':
      case 'inventory-report':
        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Item Name</th><th>Category</th><th className="amt">Qty</th><th className="amt">Value</th></tr></thead>
              <tbody>
                {state.inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td className="amt">{item.quantity}</td>
                    <td className="amt">{(item.quantity * item.purchasePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'sale-analysis': {
        const sales = state.transactions.filter(t => t.type === 'sale');
        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Date</th><th>Bill No</th><th className="amt">Amount</th><th>Action</th></tr></thead>
              <tbody>
                {sales.map(t => (
                  <tr key={t.id}>
                    <td>{formatAppDate(t.date, state.settings.dateSystem)}</td>
                    <td>{t.billNumber || t.id.substring(0, 8)}</td>
                    <td className="amt">{t.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td><button onClick={() => setVoucherModalData(t)} className="text-blue-600 underline cursor-pointer">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'imei-report': {
        const allImeis: any[] = [];
        
        state.inventory.filter(i => i.isIMEIBased).forEach(item => {
          const imeiMap: Record<string, any> = {};
          
          item.imeis.forEach(imei => {
            imeiMap[imei] = {
              itemName: item.name,
              imei,
              status: 'In Stock',
              entryDate: item.purchaseDate || 'Opening',
              supplier: item.partyName || 'Opening Stock',
              exitDate: '-',
              customer: '-',
              saleAmount: '-'
            };
          });

          const sortedTx = [...state.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          sortedTx.forEach(tx => {
            if (!tx.items) return;
            const party = state.parties.find(p => p.id === tx.partyId)?.name || 'Unknown';
            
            tx.items.forEach(li => {
              if ((li.itemId === item.id || li.sku === item.sku) && li.selectedImeis) {
                li.selectedImeis.forEach(imei => {
                  if (!imeiMap[imei]) {
                    imeiMap[imei] = { itemName: item.name, imei, status: 'Unknown', entryDate: '-', supplier: '-', exitDate: '-', customer: '-', saleAmount: '-' };
                  }
                  
                  if (tx.type === 'purchase') {
                    imeiMap[imei].entryDate = tx.date;
                    imeiMap[imei].supplier = party;
                    imeiMap[imei].status = 'In Stock';
                  } else if (tx.type === 'sale') {
                    imeiMap[imei].exitDate = tx.date;
                    imeiMap[imei].customer = party;
                    imeiMap[imei].status = 'Sold Out';
                    imeiMap[imei].saleAmount = li.price;
                  } else if (tx.type === 'purchase_return') {
                    imeiMap[imei].exitDate = tx.date;
                    imeiMap[imei].customer = `Return to ${party}`;
                    imeiMap[imei].status = 'Sold Out';
                    imeiMap[imei].saleAmount = '-';
                  } else if (tx.type === 'sale_return') {
                    imeiMap[imei].entryDate = tx.date;
                    imeiMap[imei].supplier = `Return from ${party}`;
                    imeiMap[imei].status = 'In Stock';
                    imeiMap[imei].saleAmount = '-';
                  }
                });
              }
            });
          });

          Object.keys(imeiMap).forEach(imei => {
            if (item.imeis.includes(imei)) {
              imeiMap[imei].status = 'In Stock';
            } else {
              imeiMap[imei].status = 'Sold Out';
            }
          });

          allImeis.push(...Object.values(imeiMap));
        });

        const filteredImeis = allImeis.filter(h => 
          h.imei.toLowerCase().includes(searchQuery.toLowerCase()) || 
          h.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.customer.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
          <div className="report-card active">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>IMEI / Serial No.</th>
                  <th>Status</th>
                  <th>Entry Date</th>
                  <th>Supplier (In)</th>
                  <th>Exit Date</th>
                  <th>Customer (Out)</th>
                  <th className="amt">Sale Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredImeis.map((h, i) => (
                  <tr key={i}>
                    <td>{h.itemName}</td>
                    <td className="font-mono font-bold">{h.imei}</td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        backgroundColor: h.status === 'In Stock' ? '#d4edda' : h.status === 'Sold Out' ? '#f8d7da' : '#e2e3e5',
                        color: h.status === 'In Stock' ? '#155724' : h.status === 'Sold Out' ? '#721c24' : '#383d41'
                      }}>
                        {h.status}
                      </span>
                    </td>
                    <td>{h.entryDate !== '-' ? formatAppDate(h.entryDate, state.settings.dateSystem) : '-'}</td>
                    <td>{h.supplier}</td>
                    <td>{h.exitDate !== '-' ? formatAppDate(h.exitDate, state.settings.dateSystem) : '-'}</td>
                    <td>{h.customer}</td>
                    <td className="amt">{h.saleAmount !== '-' ? h.saleAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case 'vat-summary': 
      case 'vat-return': {
        const vatSales = state.transactions.filter(t => t.type === 'sale' && !t.isVatExempt);
        const vatPurchases = state.transactions.filter(t => t.type === 'purchase' && !t.isVatExempt);
        
        const totalSalesTaxable = vatSales.reduce((sum, t) => sum + (t.taxableAmount || 0), 0);
        const totalSalesVat = vatSales.reduce((sum, t) => sum + (t.vatAmount || 0), 0);
        
        const totalPurchaseTaxable = vatPurchases.reduce((sum, t) => sum + (t.taxableAmount || 0), 0);
        const totalPurchaseVat = vatPurchases.reduce((sum, t) => sum + (t.vatAmount || 0), 0);

        return (
          <div className="report-card active">
            <table>
              <thead><tr><th>Type</th><th className="amt">Taxable Amt</th><th className="amt">VAT ({state.settings.vatRate}%)</th><th className="amt">Total</th></tr></thead>
              <tbody>
                <tr><td>Total Sales</td><td className="amt">{totalSalesTaxable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="amt">{totalSalesVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="amt">{(totalSalesTaxable + totalSalesVat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                <tr><td>Total Purchase</td><td className="amt">{totalPurchaseTaxable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="amt">{totalPurchaseVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="amt">{(totalPurchaseTaxable + totalPurchaseVat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return <div className="p-4 text-gray-500">Report section "{activeSection}" is under construction.</div>;
    }
  };

  const openDetail = (title: string, partyId: string) => {
    const partyTransactions = state.transactions.filter(t => t.partyId === partyId || t.fromPartyId === partyId || t.toPartyId === partyId);
    setModalData({ title, transactions: partyTransactions });
  };

  return (
    <div className="flex h-screen bg-[#f4f7f6] text-[#333] overflow-hidden font-sans">
      <style>{`
        .busy-dark { background: #002d5a; }
        .busy-blue { background: #004080; }
        .accent { color: #f39c12; }
        .nav-item { padding: 10px 25px; cursor: pointer; transition: 0.2s; border-bottom: 1px solid #00366b; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
        .nav-item:hover { background: #004080; padding-left: 35px; color: #f39c12; }
        .nav-item.active { background: #004080; border-left: 6px solid #f39c12; font-weight: bold; }
        .report-card { background: white; border: 1px solid #ccc; border-radius: 4px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 15px; }
        th { background: #f0f4f8; border: 1px solid #bbb; padding: 10px; text-align: left; color: #002d5a; }
        td { border: 1px solid #ddd; padding: 10px; }
        .drill-down { color: #0056b3; cursor: pointer; font-weight: 600; }
        .drill-down:hover { color: #f39c12; text-decoration: underline; }
        .amt { text-align: right; font-family: 'Consolas', monospace; font-weight: bold; }
        
        @media print {
          .sidebar, .top-bar, .search-box, button { display: none !important; }
          .main { flex: 1; display: block; }
          .content { padding: 0; overflow: visible; }
          .report-card { border: none; box-shadow: none; padding: 0; }
          body { background: white; }
        }
      `}</style>
      
      {/* Sidebar */}
      <div className="w-[300px] busy-dark text-white flex flex-col shadow-[4px_0_10px_rgba(0,0,0,0.2)] sidebar">
        <div className="p-5 text-[1.3rem] font-bold bg-[#001a35] border-b-[3px] border-[#f39c12] text-center">
          AccountAid
        </div>
        <div className="py-[10px] overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin' }}>
          <div className="px-[25px] pt-[15px] pb-[5px] text-[11px] uppercase text-[#8bb1d6] font-bold tracking-[1px]">Masters Section</div>
          <div className={`nav-item ${activeSection === 'ledger-master' ? 'active' : ''}`} onClick={() => setActiveSection('ledger-master')}>Ledger Master</div>
          <div className={`nav-item ${activeSection === 'account-groups' ? 'active' : ''}`} onClick={() => setActiveSection('account-groups')}>Account Groups</div>
          <div className={`nav-item ${activeSection === 'rate-discount' ? 'active' : ''}`} onClick={() => setActiveSection('rate-discount')}>Rate & Discount Master</div>

          <div className="px-[25px] pt-[15px] pb-[5px] text-[11px] uppercase text-[#8bb1d6] font-bold tracking-[1px]">Books (All Ledgers)</div>
          <div className={`nav-item ${activeSection === 'cash-bank' ? 'active' : ''}`} onClick={() => setActiveSection('cash-bank')}>Cash & Bank Book</div>
          <div className={`nav-item ${activeSection === 'purchase-reg' ? 'active' : ''}`} onClick={() => setActiveSection('purchase-reg')}>Purchase Register</div>
          <div className={`nav-item ${activeSection === 'sale-reg' ? 'active' : ''}`} onClick={() => setActiveSection('sale-reg')}>Sale Register</div>

          <div className="px-[25px] pt-[15px] pb-[5px] text-[11px] uppercase text-[#8bb1d6] font-bold tracking-[1px]">Final Reports</div>
          <div className={`nav-item ${activeSection === 'pl' ? 'active' : ''}`} onClick={() => setActiveSection('pl')}>Profit & Loss</div>
          <div className={`nav-item ${activeSection === 'bs' ? 'active' : ''}`} onClick={() => setActiveSection('bs')}>Balance Sheet</div>
          <div className={`nav-item ${activeSection === 'trial-bal' ? 'active' : ''}`} onClick={() => setActiveSection('trial-bal')}>Trial Balance</div>

          <div className="px-[25px] pt-[15px] pb-[5px] text-[11px] uppercase text-[#8bb1d6] font-bold tracking-[1px]">VAT & Tax Reports</div>
          <div className={`nav-item ${activeSection === 'vat-summary' ? 'active' : ''}`} onClick={() => setActiveSection('vat-summary')}>Sales/Purchase VAT Summary</div>
          <div className={`nav-item ${activeSection === 'vat-return' ? 'active' : ''}`} onClick={() => setActiveSection('vat-return')}>VAT Returns (Internal)</div>

          <div className="px-[25px] pt-[15px] pb-[5px] text-[11px] uppercase text-[#8bb1d6] font-bold tracking-[1px]">Stocks Analysis</div>
          <div className={`nav-item ${activeSection === 'stock-analysis' ? 'active' : ''}`} onClick={() => setActiveSection('stock-analysis')}>Stock Analysis</div>
          <div className={`nav-item ${activeSection === 'curr-stock' ? 'active' : ''}`} onClick={() => setActiveSection('curr-stock')}>Current Stock Status</div>
          <div className={`nav-item ${activeSection === 'stock-valuation' ? 'active' : ''}`} onClick={() => setActiveSection('stock-valuation')}>Stock Valuation</div>
          <div className={`nav-item ${activeSection === 'imei-report' ? 'active' : ''}`} onClick={() => setActiveSection('imei-report')}>IMEI/Serial Wise Stock</div>

          <div className="px-[25px] pt-[15px] pb-[5px] text-[11px] uppercase text-[#8bb1d6] font-bold tracking-[1px]">Management Reports</div>
          <div className={`nav-item ${activeSection === 'sale-analysis' ? 'active' : ''}`} onClick={() => setActiveSection('sale-analysis')}>Sale Analysis</div>
          <div className={`nav-item ${activeSection === 'inventory-report' ? 'active' : ''}`} onClick={() => setActiveSection('inventory-report')}>Detailed Inventory Report</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col main">
        <div className="bg-white px-[30px] py-[12px] border-b border-[#ddd] flex justify-between items-center top-bar">
          <h3 className="text-lg font-semibold m-0">{activeSection.replace('-', ' ').toUpperCase()}</h3>
          <div className="flex gap-2">
            <input 
              type="text" 
              className="p-2 w-[250px] border border-[#ccc] rounded mr-2 search-box" 
              placeholder="Search data..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button onClick={handleExportExcel} className="px-4 py-2 bg-[#27ae60] text-white rounded cursor-pointer hover:bg-[#219653]">Excel</button>
            <button onClick={handlePrint} className="px-4 py-2 bg-[#002d5a] text-white rounded cursor-pointer hover:bg-[#004080]">Print PDF</button>
          </div>
        </div>

        <div className="flex-1 p-[25px] overflow-y-auto content">
          {renderSection()}
        </div>
      </div>

      {/* Modal */}
      {modalData && (
        <div className="fixed inset-0 bg-white z-[9999] p-[40px] overflow-y-auto">
          <div className="flex justify-between items-center border-b-2 border-[#002d5a] pb-[15px]">
            <h2 className="text-xl font-bold">Transaction History: {modalData.title}</h2>
            <button onClick={() => setModalData(null)} className="bg-red-600 text-white border-none px-5 py-2 cursor-pointer rounded hover:bg-red-700">Close [Esc]</button>
          </div>
          <table>
            <thead>
              <tr className="bg-[#002d5a] text-white">
                <th>Date</th>
                <th>Vch Type</th>
                <th>Vch No.</th>
                <th>Particulars</th>
                <th className="amt">Debit</th>
                <th className="amt">Credit</th>
                <th className="amt">Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {modalData.transactions.map((t, i) => (
                <tr key={i}>
                  <td>{formatAppDate(t.date, state.settings.dateSystem)}</td>
                  <td className="capitalize">{t.type.replace('_', ' ')}</td>
                  <td>{t.billNumber || t.id.substring(0, 8)}</td>
                  <td>{t.description}</td>
                  <td className="amt">{t.type === 'receipt' || t.type === 'sale' ? t.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                  <td className="amt">{t.type === 'payment' || t.type === 'purchase' ? t.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                  <td className="amt">-</td>
                  <td><button onClick={() => setVoucherModalData(t)} className="text-blue-600 underline cursor-pointer">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Voucher Modal */}
      {voucherModalData && (
        <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 capitalize">{voucherModalData.type.replace('_', ' ')} Voucher</h2>
              <button onClick={() => setVoucherModalData(null)} className="text-gray-500 hover:text-red-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-semibold">{formatAppDate(voucherModalData.date, state.settings.dateSystem)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Voucher No.</p>
                  <p className="font-semibold">{voucherModalData.billNumber || voucherModalData.id.substring(0, 8)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Party</p>
                  <p className="font-semibold">{state.parties.find(p => p.id === voucherModalData.partyId)?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-semibold text-lg">{voucherModalData.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Description / Narration</p>
                <p className="bg-gray-50 p-3 rounded border text-gray-700">{voucherModalData.description || 'No description provided.'}</p>
              </div>

              {voucherModalData.items && voucherModalData.items.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">Item Details</h3>
                  <table className="w-full text-sm text-left border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 border-b">Item Name</th>
                        <th className="p-2 border-b">SKU</th>
                        <th className="p-2 border-b text-right">Qty</th>
                        <th className="p-2 border-b text-right">Rate</th>
                        <th className="p-2 border-b text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voucherModalData.items.map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2">{item.sku}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-2 text-right">{(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setVoucherModalData(null)} className="px-6 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* IMEI Modal */}
      {imeiModalData && (
        <div className="fixed inset-0 bg-white z-[9999] p-[40px] overflow-y-auto">
          <div className="flex justify-between items-center border-b-2 border-[#002d5a] pb-[15px]">
            <h2 className="text-xl font-bold">IMEI/Serial History: {imeiModalData.item.name}</h2>
            <button onClick={() => setImeiModalData(null)} className="bg-red-600 text-white border-none px-5 py-2 cursor-pointer rounded hover:bg-red-700">Close [Esc]</button>
          </div>
          <table>
            <thead>
              <tr className="bg-[#002d5a] text-white">
                <th>IMEI / Serial No.</th>
                <th>Status</th>
                <th>Entry Date</th>
                <th>Supplier (In)</th>
                <th>Exit Date</th>
                <th>Customer (Out)</th>
              </tr>
            </thead>
            <tbody>
              {imeiModalData.history.map((h, i) => (
                <tr key={i}>
                  <td className="font-mono font-bold">{h.imei}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor: h.status === 'In Stock' ? '#d4edda' : h.status === 'Sold Out' ? '#f8d7da' : '#e2e3e5',
                      color: h.status === 'In Stock' ? '#155724' : h.status === 'Sold Out' ? '#721c24' : '#383d41'
                    }}>
                      {h.status}
                    </span>
                  </td>
                  <td>{h.entryDate !== '-' ? formatAppDate(h.entryDate, state.settings.dateSystem) : '-'}</td>
                  <td>{h.supplier}</td>
                  <td>{h.exitDate !== '-' ? formatAppDate(h.exitDate, state.settings.dateSystem) : '-'}</td>
                  <td>{h.customer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
