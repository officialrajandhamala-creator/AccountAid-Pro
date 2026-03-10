
/**
 * Utility to convert an array of objects to a CSV string and trigger a browser download.
 * Handles basic escaping and Excel-friendly formatting.
 */
export const downloadCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Extract headers from the first object keys
  const headers = Object.keys(data[0]);
  
  // Map rows to CSV format
  const csvRows = [
    // Header row
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    // Data rows
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        // Handle nulls/undefined
        if (val === null || val === undefined) return '""';
        // Handle arrays (e.g., IMEIs) by joining them
        if (Array.isArray(val)) return `"${val.join('; ').replace(/"/g, '""')}"`;
        // Handle objects by stringifying
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        // Standard string/number escaping
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
