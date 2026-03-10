import { DateSystem } from '../types';

/**
 * AccountAid Date Engine
 * Supports both Gregorian (AD) and Bikram Sambat (BS) display logic.
 */
export const formatAppDate = (dateStr: string, system: DateSystem): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  
  if (system === DateSystem.AD) {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } else {
    // Advanced Mock BS Logic (approximate conversion for UI purposes)
    // Formula: AD Year + 56 Years, 8 Months, 17 Days
    const bsYear = date.getFullYear() + 56;
    const bsMonth = (date.getMonth() + 8) % 12 + 1;
    const bsDay = (date.getDate() + 17) % 30 + 1;
    
    const months = [
      'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 
      'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
    ];
    
    return `${bsDay.toString().padStart(2, '0')} ${months[bsMonth-1]} ${bsYear} (BS)`;
  }
};

export const getCurrentDateStr = () => new Date().toISOString().split('T')[0];