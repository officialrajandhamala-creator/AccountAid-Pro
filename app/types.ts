
export enum DateSystem {
  AD = 'AD',
  BS = 'BS'
}

export enum RepairStatus {
  RECEIVED = 'Received',
  DIAGNOSING = 'Diagnosing',
  REPAIRING = 'Repairing',
  COMPLETED = 'Completed',
  DELIVERED = 'Delivered'
}

// PaymentMethod now allows 'Credit' or any Treasury Party ID
export type PaymentMethod = string; 

export interface ManagedUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
  isPaused?: boolean;
}

export interface SuperAdminSession {
  teamId: string;
  isSuperAdmin: boolean;
}

export interface Location {
  id: string;
  name: string;
}

export interface IMEIUnit {
  imei: string;
  purchasePrice: number;
  salePrice: number;
  description?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minStockLevel: number;
  imeis: string[]; 
  units: IMEIUnit[]; 
  purchaseDate: string;
  purchasePrice: number;
  salePrice: number;
  partyName: string;
  isIMEIBased: boolean;
  locationId: string;
  createdBy: string;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  panNumber?: string;
  telephone?: string;
  type: 'customer' | 'supplier' | 'treasury' | 'income' | 'expense' | 'fixed_asset' | 'liability' | 'equity';
  balance: number; 
  createdBy: string;
  isSystemAccount?: boolean;
}

export interface TransactionLineItem {
  lineId: string;
  itemId: string;
  name: string;
  sku: string;
  quantity: number;
  isIMEIBased: boolean;
  price: number; 
  selectedImeis?: string[]; 
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
}

export interface Transaction {
  id: string;
  billNumber?: string;
  date: string;
  time: string;
  partyId?: string; // The "other" party (Customer/Supplier)
  fromPartyId?: string; // For internal transfers (Source Treasury)
  toPartyId?: string;   // For internal transfers (Dest Treasury)
  locationId: string; 
  items?: TransactionLineItem[]; 
  totalAmount: number;
  taxableAmount?: number;
  vatAmount?: number;
  isVatExempt?: boolean;
  type: 'sale' | 'purchase' | 'payment' | 'receipt' | 'expense' | 'income' | 'transfer' | 'sale_return' | 'purchase_return';
  paymentMethod: PaymentMethod; // Usually 'Credit' or a Treasury Party ID
  description: string;
  createdBy: string;
  receivedDenominations?: Record<number, number>;
  returnedDenominations?: Record<number, number>;
}

export interface JournalEntry {
  id: string;
  date: string;
  time: string;
  debitPartyId: string;
  creditPartyId: string;
  amount: number;
  description: string;
  createdBy: string;
}

export interface RepairPart {
  itemId: string;
  name: string;
  quantity: number;
  cost: number;
  isIMEIBased: boolean;
  selectedImeis?: string[];
}

export interface Repair {
  id: string;
  customerName: string;
  customerPhone: string;
  model: string;
  imei: string;
  issue: string;
  receivedDate: string;
  deliveryDate?: string;
  technician: string;
  estimatedCost: number;
  status: RepairStatus;
  paymentMethod: PaymentMethod;
  receivedBy?: string;
  deliveredBy?: string; 
  usedParts: RepairPart[];
  photoUrl?: string;
  createdBy: string;
}

export interface AppState {
  inventory: InventoryItem[];
  parties: Party[];
  transactions: Transaction[];
  repairs: Repair[];
  journals: JournalEntry[];
  locations: Location[];
  managedUsers: ManagedUser[]; 
  mainDeviceId: string | null;
  adminPassword: string | null;
  lastBackupDate: string | null;
  hasUnsavedChanges: boolean;
  cashVault: Record<number, number>;
  settings: {
    dateSystem: DateSystem;
    currency: string;
    securityPin: string;
    securityPinSet: boolean;
    lastPinChangeDate: string;
    vatEnabled: boolean;
    vatRate: number;
    companyName?: string;
    companyAddress?: string;
    companyPan?: string;
    companyPhone?: string;
    printerType?: 'local' | 'thermal80' | 'network' | 'pdf';
  };
}
