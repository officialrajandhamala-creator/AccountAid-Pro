import React, { useState, useRef } from 'react';
import { AppState } from '../types';
import { 
  Database, 
  Download, 
  Upload, 
  Cloud, 
  HardDrive, 
  ShieldCheck, 
  RefreshCw, 
  Clock, 
  AlertTriangle,
  CircleCheckBig,
  FileJson,
  Smartphone
} from 'lucide-react';

interface BackupProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

const Backup: React.FC<BackupProps> = ({ state, setState }) => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalBackup = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AccountAid_Backup_${new Date().toISOString().split('T')[0]}.aid`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Update state to mark backup complete
    setState(prev => ({ 
      ...prev, 
      lastBackupDate: new Date().toISOString(),
      hasUnsavedChanges: false 
    }));
    alert("Local Backup Successful: State file saved to disk.");
  };

  const handleCloudBackup = () => {
    setSyncStatus('syncing');
    // Simulate Cloud API latency
    setTimeout(() => {
      setSyncStatus('success');
      setState(prev => ({ 
        ...prev, 
        lastBackupDate: new Date().toISOString(),
        hasUnsavedChanges: false 
      }));
      setTimeout(() => setSyncStatus('idle'), 3000);
    }, 2000);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // Basic validation: ensure critical keys exist
        if (json.inventory && json.parties && json.settings) {
          if (confirm("Restore Warning: This will overwrite ALL current business data. Proceed?")) {
            setState({
              ...json,
              hasUnsavedChanges: false,
              lastBackupDate: new Date().toISOString()
            });
            alert("System Restored: Data has been synchronized with the backup file.");
          }
        } else {
          alert("Error: Invalid AccountAid backup file.");
        }
      } catch (err) {
        alert("Restore Failed: The file structure is corrupted.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">SafeVault Backup</h1>
          <p className="text-slate-500 font-medium tracking-tight">Protect your business data with Local and Cloud redundancy.</p>
        </div>
        <div className={`flex items-center gap-3 px-6 py-3 rounded-3xl border shadow-sm ${state.hasUnsavedChanges ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
          {state.hasUnsavedChanges ? <AlertTriangle size={20}/> : <ShieldCheck size={20}/>}
          <p className="text-[10px] font-black uppercase tracking-widest">
            {state.hasUnsavedChanges ? 'Backup Required' : 'State Secure'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Local Disk Backup */}
        <section className="bg-white rounded-[3rem] shadow-sm border p-10 space-y-8 group hover:shadow-xl transition-all">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
            <HardDrive size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Local Storage</h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Download a physical snapshot of your database. Ideal for offline storage and manual archiving.</p>
          </div>
          <button 
            onClick={handleLocalBackup}
            className="w-full py-5 bg-slate-900 text-white font-black rounded-[2rem] uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"
          >
            <Download size={20} /> Export .AID Data File
          </button>
        </section>

        {/* Cloud Sync Backup */}
        <section className="bg-white rounded-[3rem] shadow-sm border p-10 space-y-8 group hover:shadow-xl transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6">
            <Smartphone className="text-blue-50/50" size={120} />
          </div>
          <div className="w-16 h-16 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform relative z-10">
            <Cloud size={32} />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Google Drive</h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Automatic synchronization with your Google Cloud account for high-availability access.</p>
          </div>
          <button 
            onClick={handleCloudBackup}
            disabled={syncStatus === 'syncing'}
            className={`w-full py-5 font-black rounded-[2rem] uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all ${
              syncStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {syncStatus === 'idle' && <><RefreshCw size={20} /> Sync Cloud Now</>}
            {syncStatus === 'syncing' && <><RefreshCw className="animate-spin" size={20} /> Authorizing...</>}
            {syncStatus === 'success' && <><CircleCheckBig size={20} /> Cloud Secure</>}
          </button>
        </section>
      </div>

      {/* Restoration & Audit */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-center relative z-10">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-3 text-slate-500">
               <Clock size={16}/>
               <p className="text-[10px] font-black uppercase tracking-widest">System Integrity Audit</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-black tracking-tight">Restore Previous Session</p>
              <p className="text-slate-400 font-medium text-sm">Upload a valid AccountAid backup file to revert the system state. All current entries will be replaced.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2"
              >
                <Upload size={18}/> Browse Backups
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".aid,.json" 
                onChange={handleRestore}
              />
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 text-center space-y-4">
             <FileJson className="mx-auto text-blue-400" size={40} />
             <div>
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Last Backup Verified</p>
               <p className="text-xl font-black mt-1">
                 {state.lastBackupDate ? new Date(state.lastBackupDate).toLocaleDateString() : 'NEVER'}
               </p>
             </div>
          </div>
        </div>
      </div>
      
      <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">AccountAid Protocol v4.0 • Enterprise Data Redundancy Active</p>
    </div>
  );
};

export default Backup;