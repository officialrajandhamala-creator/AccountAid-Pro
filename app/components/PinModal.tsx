
import React, { useState } from 'react';
import { Lock, X, ShieldAlert } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin: string;
}

const PinModal: React.FC<PinModalProps> = ({ isOpen, onClose, onSuccess, correctPin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      setError(false);
      onSuccess();
      setPin('');
    } else {
      setError(true);
      setPin('');
      // Shake effect or feedback
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className={`bg-white w-full max-w-xs rounded-3xl shadow-2xl p-8 border border-slate-200 transition-transform ${error ? 'animate-bounce' : 'animate-in zoom-in duration-200'}`}>
        <div className="text-center mb-6">
          <div className={`w-16 h-16 ${error ? 'bg-red-100 text-red-600' : 'bg-slate-900 text-white'} rounded-full flex items-center justify-center mx-auto mb-4 transition-colors`}>
            {error ? <ShieldAlert size={32} /> : <Lock size={32} />}
          </div>
          <h2 className="text-xl font-black text-slate-900">Security Clearance</h2>
          <p className="text-sm text-slate-500 font-medium">Enter 4-digit PIN to authorize action</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            autoFocus
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full text-center text-4xl tracking-[1em] font-black py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
            placeholder="••••"
          />

          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 shadow-xl transition-all"
            >
              Authorize
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinModal;
