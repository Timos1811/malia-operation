import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

const COLUMNS = [
  'מספר הזמנה',
  'לקוחות',
  'לילות',
  'מגדר',
  'גיל',
  'מלון',
  'חברה',
  'סכום מבוקש',
  'EUR',
  'שקל',
  'דולר',
  'סטטוס בEUR'
];

const COLUMN_KEYS = [
  'order_number',
  'customer',
  'nights',
  'gender',
  'age',
  'hotel',
  'company',
  'requested_amount',
  'eur_amount',
  'shekel_amount',
  'dollar_amount',
  'eur_status'
];

export default function Table() {
    const rows = 5;

    const [tableData, setTableData] = useState(() => {
      const saved = localStorage.getItem('tableData');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return Array.from({ length: rows }, () => COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {}));
        }
      }
      return Array.from({ length: rows }, () => COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {}));
    });
    const [editingCell, setEditingCell] = useState(null);
    const [fetchingRows, setFetchingRows] = useState(new Set());
    const [missingFields, setMissingFields] = useState({});

    React.useEffect(() => {
      localStorage.setItem('tableData', JSON.stringify(tableData));
    }, [tableData]);

    React.useEffect(() => {
      // Auto-fetch order details on mount for existing order numbers
      tableData.forEach((row, index) => {
        if (row.order_number?.trim() && row.order_number.trim().length >= 7 && !row.customer) {
          fetchOrderDetails(index, row.order_number);
        }
      });
    }, []);

  const fetchOrderDetails = async (rowIndex, orderNumber) => {
    const trimmedOrderNumber = orderNumber.trim();

    if (!trimmedOrderNumber || fetchingRows.has(rowIndex)) {
      return;
    }

    setFetchingRows(prev => new Set(prev).add(rowIndex));

    try {
      const response = await base44.functions.invoke('fetchOrderData', { orderNumber: trimmedOrderNumber });

      if (response.data) {
        setTableData(prevData => {
          const newData = [...prevData];
          newData[rowIndex] = {
            ...newData[rowIndex],
            customer: response.data.customer,
            nights: response.data.nights,
            hotel: response.data.hotel,
            gender: response.data.gender
          };
          return newData;
        });
        toast.success('נתונים נמלאו מגוגל שיטס');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('מספר הזמנה לא נמצא');
      } else {
        toast.error('שגיאה בטעינת נתונים');
      }
    } finally {
      setFetchingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowIndex);
        return newSet;
      });
    }
  };

  const handleCellChange = (rowIndex, colKey, value) => {
    const newData = [...tableData];
    newData[rowIndex][colKey] = value;

    // Determine company based on first digit when order number changes
    if (colKey === 'order_number') {
      const trimmedOrderNumber = value.trim();
      if (trimmedOrderNumber.startsWith('5')) {
        newData[rowIndex]['company'] = 'קשרי תעופה';
      } else if (trimmedOrderNumber.startsWith('1')) {
        newData[rowIndex]['company'] = 'נטו פאן';
      } else if (trimmedOrderNumber.length > 0) {
        newData[rowIndex]['company'] = 'כספר';
      }
    }

    setTableData(newData);

    // Clear error for this field
    if (missingFields[rowIndex]?.includes(colKey)) {
      setMissingFields(prev => {
        const newMissing = { ...prev };
        newMissing[rowIndex] = newMissing[rowIndex].filter(field => field !== colKey);
        if (newMissing[rowIndex].length === 0) {
          delete newMissing[rowIndex];
        }
        return newMissing;
      });
    }

    // Auto-fetch when order number changes and has at least 7 digits
    if (colKey === 'order_number' && value.trim().length >= 7 && !newData[rowIndex].customer) {
      fetchOrderDetails(rowIndex, value);
    }
  };

  const handleCellBlur = async (e, rowIndex, colKey, value) => {
    // Fetch order details when leaving order_number cell
    if (colKey === 'order_number' && value.trim() !== '') {
      await fetchOrderDetails(rowIndex, value);
    }

    // Only blur if we're not clicking on another cell
    if (!e.relatedTarget || !e.relatedTarget.closest('td')) {
      setTimeout(() => setEditingCell(null), 0);
    }
  };

  const handleKeyDown = async (e, rowIndex, colKey, value) => {
    if (e.key === 'Enter') {
      // Fetch order details when pressing Enter on order_number cell
      if (colKey === 'order_number' && value.trim() !== '') {
        await fetchOrderDetails(rowIndex, value);
      }
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const currentColIndex = COLUMN_KEYS.indexOf(colKey);
      
      if (e.shiftKey) {
        // Shift+Tab - move to previous cell
        if (currentColIndex > 0) {
          setEditingCell({ row: rowIndex, col: COLUMN_KEYS[currentColIndex - 1] });
        } else if (rowIndex > 0) {
          setEditingCell({ row: rowIndex - 1, col: COLUMN_KEYS[COLUMN_KEYS.length - 1] });
        }
      } else {
        // Tab - move to next cell
        if (currentColIndex < COLUMN_KEYS.length - 1) {
          setEditingCell({ row: rowIndex, col: COLUMN_KEYS[currentColIndex + 1] });
        } else if (rowIndex < tableData.length - 1) {
          setEditingCell({ row: rowIndex + 1, col: COLUMN_KEYS[0] });
        }
      }
    }
  };

  const handleAddRow = async () => {
    // Validate that all required fields are filled
    const requiredFields = COLUMN_KEYS.filter(key => 
      key !== 'eur_status' && key !== 'eur_amount' && key !== 'shekel_amount' && key !== 'dollar_amount'
    );
    const newMissingFields = {};
    let hasErrors = false;

    for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      const hasData = COLUMN_KEYS.some(key => row[key]?.trim() !== '');

      if (hasData) {
        // Check if all required fields are filled
        const missing = requiredFields.filter(key => !row[key]?.trim());
        if (missing.length > 0) {
          newMissingFields[rowIndex] = missing;
          hasErrors = true;
        }

        // Check if at least one currency field is filled
        const hasAnyCurrency = row.eur_amount?.trim() || row.shekel_amount?.trim() || row.dollar_amount?.trim();
        if (!hasAnyCurrency) {
          if (!newMissingFields[rowIndex]) newMissingFields[rowIndex] = [];
          newMissingFields[rowIndex].push('eur_amount', 'shekel_amount', 'dollar_amount');
          hasErrors = true;
        }
      }
    }

    if (hasErrors) {
      setMissingFields(newMissingFields);
      toast.error('יש למלא את כל השדות החובה ולפחות מטבע אחד');
      return;
    }

    // Save all rows with data
    for (const row of tableData) {
      const hasData = COLUMN_KEYS.some(key => row[key]?.trim() !== '');
      if (hasData) {
        await base44.entities.TableData.create(row);
      }
    }

    // Reset the table and clear errors
    const emptyData = Array.from({ length: rows }, () => COLUMN_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {}));
    setTableData(emptyData);
    localStorage.setItem('tableData', JSON.stringify(emptyData));
    setMissingFields({});
    toast.success('הנתונים נשמרו בהצלחה!');
  };

  return (
    <div className="p-8 md:p-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-light text-slate-800 tracking-tight mb-8">
          טבלת נתונים
        </h1>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50/80">
                {COLUMNS.map((colName, colIndex) => (
                  <th 
                    key={colIndex} 
                    className="px-4 py-4 text-right text-xs font-medium text-slate-500 border-b border-slate-200/60 whitespace-nowrap"
                  >
                    {colName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  className="hover:bg-slate-50/50 transition-colors duration-200"
                >
                  {COLUMN_KEYS.map((colKey, colIndex) => {
                    // Calculate EUR status with all currencies
                    let eurStatus = '';
                    let eurStatusColor = '';
                    if (colKey === 'eur_status') {
                      const eurAmount = parseFloat(row.eur_amount) || 0;
                      const shekelAmount = parseFloat(row.shekel_amount) || 0;
                      const dollarAmount = parseFloat(row.dollar_amount) || 0;
                      const requestedAmount = parseFloat(row.requested_amount) || 0;

                      // Convert to EUR: 1 Shekel = 0.26 EUR, 1 Dollar = 0.95 EUR
                      const totalInEur = eurAmount + (shekelAmount * 0.26) + (dollarAmount * 0.95);

                      if (totalInEur && requestedAmount) {
                        const diff = totalInEur - requestedAmount;
                        if (diff > 0) {
                          eurStatus = `+${diff.toFixed(2)}`;
                          eurStatusColor = 'bg-green-100 text-green-800';
                        } else if (diff < 0) {
                          eurStatus = diff.toFixed(2);
                          eurStatusColor = 'bg-red-100 text-red-800';
                        } else {
                          eurStatus = 'מאוזן';
                          eurStatusColor = 'bg-slate-100 text-slate-600';
                        }
                      }
                    }

                    const isMissing = missingFields[rowIndex]?.includes(colKey);

                    return (
                      <td 
                        key={colKey} 
                        className="px-2 py-2 text-sm border-b border-slate-100 last:border-b-0"
                      >
                        {colKey === 'eur_status' ? (
                          <div 
                            className={`px-4 py-2 min-h-[36px] rounded-lg flex items-center justify-center font-medium ${eurStatusColor}`}
                          >
                            {eurStatus || <span className="text-slate-400">—</span>}
                          </div>
                        ) : editingCell?.row === rowIndex && editingCell?.col === colKey ? (
                          <Input
                            autoFocus
                            value={row[colKey]}
                            onChange={(e) => handleCellChange(rowIndex, colKey, e.target.value)}
                            onBlur={(e) => handleCellBlur(e, rowIndex, colKey, row[colKey])}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, colKey, row[colKey])}
                            className={`h-9 focus:border-slate-500 focus:ring-slate-500 text-right ${isMissing ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                          />
                        ) : (
                          <div 
                            className={`px-4 py-2 min-h-[36px] rounded-lg cursor-text hover:bg-slate-100 transition-colors flex items-center ${isMissing ? 'bg-red-100 border-2 border-red-500' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setEditingCell({ row: rowIndex, col: colKey });
                            }}
                          >
                            {row[colKey] || <span className="text-slate-400">—</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-center">
          <Button 
            onClick={handleAddRow}
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-base font-medium rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20 transition-all duration-300 ease-out"
          >
            <Plus className="w-5 h-5 ml-2" />
            הוסף
          </Button>
        </div>
      </div>
    </div>
  );
}