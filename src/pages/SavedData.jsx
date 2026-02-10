import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from "@/api/base44Client";
import { Loader2, Database, ExternalLink, Search, Filter, X, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";
import AskData from "@/components/AskData";

const COLUMNS = [
  'תאריך הכנסה',
  'מספר הזמנה',
  'תאריך עזיבה',
  'לקוחות',
  'לילות',
  'מגדר',
  'מלון',
  'חברה',
  'סכום מבוקש',
  'EUR',
  'שקל',
  'דולר',
  'ביט',
  'סטטוס בEUR',
  'שם נציג',
  'הערות'
];

const COLUMN_KEYS = [
  'created_date',
  'order_number',
  'departure_date',
  'customer',
  'nights',
  'gender',
  'hotel',
  'company',
  'requested_amount',
  'eur_amount',
  'shekel_amount',
  'dollar_amount',
  'bit_amount',
  'eur_status',
  'sales_rep',
  'comments'
];

export default function SavedData() {
    const [editingCell, setEditingCell] = useState(null);
    const [fetchingRows, setFetchingRows] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
      startDate: null,
      endDate: null,
      salesRep: 'all'
    });
    const attemptedRows = useRef(new Set());
    const queryClient = useQueryClient();
  
  const { data: savedRows = [], isLoading, isError, error } = useQuery({
    queryKey: ['tableData'],
    queryFn: async () => {
      try {
        return await base44.entities.TableData.list('-created_date');
      } catch (err) {
        throw new Error(err.message || 'שגיאה בטעינת נתונים שמורים');
      }
    },
  });

  // Extract unique sales reps for filter
  const salesReps = React.useMemo(() => {
    const reps = new Set(savedRows.map(r => r.sales_rep).filter(Boolean));
    return Array.from(reps).sort();
  }, [savedRows]);

  // Filter Logic
  const filteredRows = React.useMemo(() => {
    return savedRows.filter(row => {
      // Search Query
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (row.order_number?.toLowerCase().includes(searchLower)) ||
        (row.customer?.toLowerCase().includes(searchLower)) ||
        (row.hotel?.toLowerCase().includes(searchLower)) ||
        (row.company?.toLowerCase().includes(searchLower)) ||
        (row.comments?.toLowerCase().includes(searchLower));

      // Date Range Filter (based on created_date)
      let matchesDate = true;
      if (filters.startDate || filters.endDate) {
        const rowDate = new Date(row.created_date);
        rowDate.setHours(0, 0, 0, 0);
        
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (rowDate < start) matchesDate = false;
        }
        
        if (filters.endDate && matchesDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (rowDate > end) matchesDate = false;
        }
      }

      // Sales Rep Filter
      const matchesRep = filters.salesRep === 'all' || row.sales_rep === filters.salesRep;

      return matchesSearch && matchesDate && matchesRep;
    });
  }, [savedRows, searchQuery, filters]);

  React.useEffect(() => {
    // Auto-fetch order details on mount for existing order numbers
    const processRows = async () => {
      if (savedRows && savedRows.length > 0) {
        for (const row of savedRows) {
          // Check if we already attempted to fetch this row in this session to avoid loops
          const shouldFetch = row.order_number?.trim() && 
                            row.order_number.trim().length >= 7 && 
                            !row.customer && 
                            !attemptedRows.current.has(row.id);

          if (shouldFetch) {
            attemptedRows.current.add(row.id);
            await fetchAndUpdateOrder(row.id, row.order_number);
            // Add a small delay between requests to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    };
    processRows();
  }, [savedRows]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TableData.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tableData'] });
    },
  });

  const fetchAndUpdateOrder = async (rowId, orderNumber) => {
    const trimmedOrderNumber = orderNumber.trim();

    if (!trimmedOrderNumber || fetchingRows.has(rowId)) {
      return;
    }

    setFetchingRows(prev => new Set(prev).add(rowId));

    try {
      const response = await base44.functions.invoke('fetchOrderData', { orderNumber: trimmedOrderNumber });

      if (response.data) {
        updateMutation.mutate({
          id: rowId,
          data: {
            customer: response.data.customer,
            nights: response.data.nights,
            hotel: response.data.hotel,
            gender: response.data.gender,
            departure_date: response.data.departureDate
          }
        });
        toast.success('נתונים נמלאו מגוגל שיטס');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      if (error.response?.status === 401) {
        toast.error('יש להתחבר למערכת כדי לטעון נתונים');
      } else if (error.response?.status === 404) {
        toast.error('מספר הזמנה לא נמצא');
      } else {
        toast.error('שגיאה בטעינת נתונים: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setFetchingRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(rowId);
        return newSet;
      });
    }
  };

  const handleCellChange = async (rowId, colKey, value) => {
    // Determine company based on first digit when order number changes
    if (colKey === 'order_number') {
      const trimmedOrderNumber = value.trim();
      let company = '';
      if (trimmedOrderNumber.startsWith('5')) {
        company = 'קשרי תעופה';
      } else if (trimmedOrderNumber.startsWith('1')) {
        company = 'נטו פאן';
      } else if (trimmedOrderNumber.length > 0) {
        company = 'כספר';
      }

      // Update order number and company first
      updateMutation.mutate({
        id: rowId,
        data: { order_number: trimmedOrderNumber, company: company }
      });

      // Then fetch additional data from Google Sheets
      if (trimmedOrderNumber.length >= 7) {
        await fetchAndUpdateOrder(rowId, trimmedOrderNumber);
      }
      return;
    }

    updateMutation.mutate({
      id: rowId,
      data: { [colKey]: value }
    });
  };

  const handleCellBlur = (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest('td')) {
      setTimeout(() => setEditingCell(null), 0);
    }
  };

  const handleKeyDown = (e, rowId, colKey, value) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
      handleCellChange(rowId, colKey, value);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellChange(rowId, colKey, value);
      
      const currentRowIndex = filteredRows.findIndex(r => r.id === rowId);
      const currentColIndex = COLUMN_KEYS.indexOf(colKey);
      
      if (e.shiftKey) {
        // Shift+Tab - move to previous cell
        if (currentColIndex > 0) {
          setEditingCell({ row: rowId, col: COLUMN_KEYS[currentColIndex - 1] });
        } else if (currentRowIndex > 0) {
          setEditingCell({ row: filteredRows[currentRowIndex - 1].id, col: COLUMN_KEYS[COLUMN_KEYS.length - 1] });
        }
      } else {
        // Tab - move to next cell
        if (currentColIndex < COLUMN_KEYS.length - 1) {
          setEditingCell({ row: rowId, col: COLUMN_KEYS[currentColIndex + 1] });
        } else if (currentRowIndex < filteredRows.length - 1) {
          setEditingCell({ row: filteredRows[currentRowIndex + 1].id, col: COLUMN_KEYS[0] });
        }
      }
    }
  };

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center space-y-4">
            <Database className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800">שגיאה בטעינת הנתונים</h2>
            <p className="text-slate-500">{error?.message}</p>
            <Button onClick={() => window.location.reload()} variant="outline">נסה שוב</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Database className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            נתונים שמורים
          </h1>
        </div>

        <AskData type="income" />
        
        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="חיפוש לפי הזמנה, לקוח, מלון..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`justify-start text-right font-normal ${!filters.startDate && "text-muted-foreground"}`}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, "P", { locale: he }) : "מתאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-slate-400">-</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`justify-start text-right font-normal ${!filters.endDate && "text-muted-foreground"}`}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, "P", { locale: he }) : "עד תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Sales Rep Filter */}
            <Select 
              value={filters.salesRep} 
              onValueChange={(val) => setFilters(prev => ({ ...prev, salesRep: val }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="סינון לפי נציג" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הנציגים</SelectItem>
                {salesReps.map(rep => (
                  <SelectItem key={rep} value={rep}>{rep}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {(searchQuery || filters.startDate || filters.endDate || filters.salesRep !== 'all') && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ startDate: null, endDate: null, salesRep: 'all' });
                }}
                className="text-slate-500 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Database className="w-12 h-12 mb-4" />
              <p className="text-lg">לא נמצאו נתונים תואמים לחיפוש</p>
              <Button 
                variant="link" 
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ startDate: null, endDate: null, salesRep: 'all' });
                }}
              >
                נקה סינונים
              </Button>
            </div>
          ) : (
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
                {filteredRows.map((row) => {
                  // Check if EUR status is negative (including all currencies)
                  const eurAmount = parseFloat(row.eur_amount) || 0;
                  const shekelAmount = parseFloat(row.shekel_amount) || 0;
                  const dollarAmount = parseFloat(row.dollar_amount) || 0;
                  const bitAmount = parseFloat(row.bit_amount) || 0;
                  const requestedAmount = parseFloat(row.requested_amount) || 0;
                  const totalInEur = eurAmount + (shekelAmount * 0.26) + (dollarAmount * 0.95) + (bitAmount * 0.26);
                  const isNegative = totalInEur && requestedAmount && (totalInEur - requestedAmount) < 0;

                  return (
                  <tr 
                    key={row.id} 
                    className={`transition-colors duration-200 ${isNegative ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50/50'}`}
                  >
                    {COLUMN_KEYS.map((colKey) => {
                      // Calculate EUR status with all currencies
                      let eurStatus = '';
                      let eurStatusColor = '';
                      if (colKey === 'eur_status') {
                        const eurAmount = parseFloat(row.eur_amount) || 0;
                        const shekelAmount = parseFloat(row.shekel_amount) || 0;
                        const dollarAmount = parseFloat(row.dollar_amount) || 0;
                        const bitAmount = parseFloat(row.bit_amount) || 0;
                        const requestedAmount = parseFloat(row.requested_amount) || 0;

                        // Convert to EUR: 1 Shekel = 0.26 EUR, 1 Dollar = 0.95 EUR, 1 Bit = 0.26 EUR
                        const totalInEur = eurAmount + (shekelAmount * 0.26) + (dollarAmount * 0.95) + (bitAmount * 0.26);

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

                      return (
                        <td 
                          key={colKey} 
                          className="px-2 py-2 text-sm border-b border-slate-100 last:border-b-0"
                        >
                          {colKey === 'created_date' ? (
                            <div className="px-4 py-2 min-h-[36px] flex items-center text-slate-600 font-medium cursor-default">
                              {row.created_date ? new Date(row.created_date).toLocaleDateString('he-IL') : '-'}
                            </div>
                          ) : colKey === 'eur_status' ? (
                            <div 
                              className={`px-4 py-2 min-h-[36px] rounded-lg flex items-center justify-center font-medium ${eurStatusColor}`}
                            >
                              {eurStatus || <span className="text-slate-400">—</span>}
                            </div>
                          ) : editingCell?.row === row.id && editingCell?.col === colKey ? (
                            <Input
                              autoFocus
                              defaultValue={row[colKey]}
                              onBlur={(e) => {
                                handleCellBlur(e);
                                // Trigger update on blur for all fields including order_number
                                handleCellChange(row.id, colKey, e.target.value);
                              }}
                              onKeyDown={(e) => handleKeyDown(e, row.id, colKey, e.target.value)}
                              className="h-9 border-slate-300 focus:border-slate-500 focus:ring-slate-500 text-right"
                            />
                          ) : (
                            <div 
                              className="px-4 py-2 min-h-[36px] rounded-lg cursor-text hover:bg-slate-100 transition-colors flex items-center"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setEditingCell({ row: row.id, col: colKey });
                              }}
                            >
                              {colKey === 'order_number' && row[colKey] ? (
                                <Link 
                                  to={`${createPageUrl('OrderDetails')}?orderNumber=${row[colKey]}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                >
                                  {row[colKey]}
                                  <ExternalLink className="w-3 h-3 opacity-50" />
                                </Link>
                              ) : (
                                row[colKey] || <span className="text-slate-400">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                      })}
                      </tr>
                      );
                      })}
                      </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}