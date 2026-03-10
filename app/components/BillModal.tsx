import React from 'react';
import { Transaction, AppState } from '../types';
import { Printer, X } from 'lucide-react';
import { formatAppDate } from '../utils/dateUtils';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface BillModalProps {
  transaction: Transaction;
  state: AppState;
  onClose: () => void;
}

const BillModal: React.FC<BillModalProps> = ({ transaction, state, onClose }) => {
  const party = state.parties.find(p => p.id === transaction.partyId);
  const isTaxable = state.settings.vatEnabled && !transaction.isVatExempt;

  const handlePrint = async () => {
    const printerType = state.settings.printerType;
    
    if (!printerType) {
      alert("Printer Configuration Missing: Please set up a default printer in the Settings module before printing.");
      return;
    }

    if (printerType === 'pdf') {
      try {
        const element = document.getElementById('printable-bill');
        if (!element) return;
        
        const invoiceNumber = transaction.billNumber || transaction.id.split('-')[0].toUpperCase();
        const dateStr = transaction.date.replace(/-/g, '');
        
        const opt = {
          margin:       0.5,
          filename:     `Invoice_${invoiceNumber}_${dateStr}.pdf`,
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
      // For local, thermal80, network
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-white w-full ${state.settings.printerType === 'thermal80' ? 'max-w-sm' : 'max-w-3xl'} rounded-[2rem] shadow-2xl flex flex-col my-8`}>
        <div className="p-6 border-b flex justify-between items-center print:hidden">
          <h2 className="text-xl font-black uppercase">Invoice / Bill</h2>
          <div className="flex gap-4">
            <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 hover:bg-blue-700">
              <Printer size={16} /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={`p-10 print:p-0 print:m-0 bg-white ${state.settings.printerType === 'thermal80' ? 'text-xs' : ''}`} id="printable-bill">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black uppercase tracking-tighter">{state.settings.companyName || 'Company Name'}</h1>
            <p className="text-sm font-bold text-slate-600">{state.settings.companyAddress || 'Company Address'}</p>
            <p className="text-sm font-bold text-slate-600">PAN/VAT: {state.settings.companyPan || 'N/A'} | Tel: {state.settings.companyPhone || 'N/A'}</p>
            <h2 className="text-xl font-black uppercase mt-4 border-b-2 border-slate-900 inline-block pb-1">Tax Invoice</h2>
          </div>

          {/* Bill Info */}
          <div className="flex justify-between mb-8 text-sm">
            <div>
              <p><span className="font-bold">Bill To:</span> {party?.name || 'Cash Customer'}</p>
              {party?.address && <p><span className="font-bold">Address:</span> {party.address}</p>}
              {party?.panNumber && <p><span className="font-bold">PAN/VAT:</span> {party.panNumber}</p>}
              {party?.phone && <p><span className="font-bold">Phone:</span> {party.phone}</p>}
            </div>
            <div className="text-right">
              <p><span className="font-bold">Invoice No:</span> {transaction.billNumber || transaction.id.split('-')[0].toUpperCase()}</p>
              <p><span className="font-bold">Date:</span> {formatAppDate(transaction.date, state.settings.dateSystem)}</p>
              <p><span className="font-bold">Payment:</span> {transaction.paymentMethod === 'Credit' ? 'Credit' : 'Cash/Bank'}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full mb-8 border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left text-xs uppercase tracking-wider">
                <th className="py-2">S.N.</th>
                <th className="py-2">Particulars</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Discount</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transaction.items?.map((item, idx) => {
                const baseAmount = item.quantity * item.price;
                const discountAmount = item.discountType === 'percentage' ? baseAmount * ((item.discountValue || 0) / 100) : (item.discountValue || 0);
                const finalAmount = baseAmount - discountAmount;
                return (
                  <tr key={item.lineId} className="border-b border-slate-200 text-sm">
                    <td className="py-3">{idx + 1}</td>
                    <td className="py-3">
                      <div className="font-bold">{item.name}</div>
                      {item.isIMEIBased && item.selectedImeis && item.selectedImeis.length > 0 && (
                        <div className="text-[10px] text-slate-500 mt-1">SN: {item.selectedImeis.join(', ')}</div>
                      )}
                    </td>
                    <td className="py-3 text-center">{item.quantity}</td>
                    <td className="py-3 text-right">{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-3 text-right">{discountAmount > 0 ? discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                    <td className="py-3 text-right">{finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-16">
            <div className="w-64 space-y-2 text-sm">
              {isTaxable ? (
                <>
                  <div className="flex justify-between">
                    <span className="font-bold">Taxable Amount:</span>
                    <span>{state.settings.currency} {(transaction.taxableAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">VAT ({state.settings.vatRate}%):</span>
                    <span>{state.settings.currency} {(transaction.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="font-bold">Subtotal:</span>
                  <span>{state.settings.currency} {transaction.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-lg font-black">
                <span>Total:</span>
                <span>{state.settings.currency} {transaction.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end mt-20 pt-8 border-t border-slate-200">
            <div className="text-center">
              <div className="w-40 border-b border-slate-900 mb-2"></div>
              <p className="text-xs font-bold uppercase tracking-widest">Authorized Signature</p>
              <p className="text-[10px] text-slate-500 mt-1">{transaction.createdBy}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Made with AccountAid</p>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-bill, #printable-bill * {
            visibility: visible;
          }
          #printable-bill {
            position: absolute;
            left: 0;
            top: 0;
            width: ${state.settings.printerType === 'thermal80' ? '80mm' : '100%'};
            margin: 0;
            padding: ${state.settings.printerType === 'thermal80' ? '0' : '20px'};
          }
          ${state.settings.printerType === 'thermal80' ? `
            @page {
              margin: 0;
              size: 80mm auto;
            }
          ` : ''}
        }
      `}</style>
    </div>
  );
};

export default BillModal;
