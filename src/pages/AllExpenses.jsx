import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Receipt, Search, Filter, X, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "sonner";

const COLUMNS = [
  { key: 'created_date', label: 'תאריך יצירה', type: 'readonly' },
  { key: 'reason', label: 'סיבת הוצאה', type: 'select', options: ['יצא מהיעד', 'החזר מלא', 'החזר חלקי', 'רכב', 'אחר', 'משיכה לאדם', 'תשלום לספק', 'פיצוי קשרי תעופה', 'פיצוי נטו פאן', 'פינוק ללקוחות', 'פינוק לנציגים', 'אשל'] },
  { key: 'recipient', label: 'למי הועבר', type: 'text' },
  { key: 'amount', label: 'סכום', type: 'number' },
  { key: 'currency', label: 'מטבע', type: 'select' },
  { key: 'notes', label: 'הערות', type: 'text' },
  { key: 'event_name', label: 'אירוע', type: 'select', options: ['קודו', 'קנדי', 'הסעות'] },
  { key: 'event_date', label: 'תאריך אירוע', type: 'date' },
  { key: 'buyers_count', label: 'קונים', type: 'number' },
  { key: 'scanned_count', label: 'נסרקים', type: 'number' },
];

export default function AllExpenses() {
  const [editingCell, setEditingCell] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    reason: 'all',
    recipient: 'all'
  });
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date'),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.ExpenseEvent.list(),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 300000,
  });

  const isLoading = isLoadingExpenses || isLoadingEvents;

  // Map events to expenses (1-to-1 assumption per UI)
  const eventsMap = React.useMemo(() => {
    const map = {};
    events.forEach(event => {
        map[event.expense_id] = event;
    });
    return map;
  }, [events]);

  const uniqueRecipients = React.useMemo(() => {
      const recipients = new Set(expenses.map(e => e.recipient).filter(Boolean));
      return Array.from(recipients).sort();
  }, [expenses]);

  // Filter Logic
  const filteredExpenses = React.useMemo(() => {
    return expenses.filter(expense => {
      // Search Query
      const searchLower = searchQuery.toLowerCase();
      const event = eventsMap[expense.id] || {};
      const matchesSearch = !searchQuery || 
        (expense.recipient?.toLowerCase().includes(searchLower)) ||
        (expense.reason?.toLowerCase().includes(searchLower)) ||
        (expense.notes?.toLowerCase().includes(searchLower)) ||
        (event.event_name?.toLowerCase().includes(searchLower));

      // Date Range Filter (based on created_date)
      let matchesDate = true;
      if (filters.startDate || filters.endDate) {
        const rowDate = new Date(expense.created_date);
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

      // Reason Filter
      const matchesReason = filters.reason === 'all' || expense.reason === filters.reason;

      // Recipient Filter
      const matchesRecipient = filters.recipient === 'all' || expense.recipient === filters.recipient;

      return matchesSearch && matchesDate && matchesReason && matchesRecipient;
    });
  }, [expenses, eventsMap, searchQuery, filters]);

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: () => toast.error('שגיאה בעדכון ההוצאה')
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ expenseId, eventId, data }) => {
        if (eventId) {
            return base44.entities.ExpenseEvent.update(eventId, data);
        } else {
            return base44.entities.ExpenseEvent.create({ ...data, expense_id: expenseId });
        }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => toast.error('שגיאה בעדכון פרטי אירוע')
  });

  const handleCellChange = (expenseId, field, value) => {
    // Check if field belongs to Expense or ExpenseEvent
    const isEventField = ['event_name', 'event_date', 'buyers_count', 'scanned_count'].includes(field);
    
    if (isEventField) {
        const event = eventsMap[expenseId];
        const eventId = event?.id;
        
        // Parse numbers
        let finalValue = value;
        if (field === 'buyers_count' || field === 'scanned_count') {
            finalValue = parseInt(value) || 0;
        }

        updateEventMutation.mutate({ expenseId, eventId, data: { [field]: finalValue } });
    } else {
        const finalValue = field === 'amount' ? parseFloat(value) : value;
        updateExpenseMutation.mutate({ id: expenseId, data: { [field]: finalValue } });
    }
  };

  const handleCellBlur = (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest('td')) {
      setTimeout(() => setEditingCell(null), 0);
    }
  };

  const handleKeyDown = (e, rowId, colKey) => {
      const expensesList = filteredExpenses;
      const currentRowIndex = expensesList.findIndex(r => r.id === rowId);
      const currentColIndex = COLUMNS.findIndex(c => c.key === colKey);

      if (e.key === 'Enter') {
        setEditingCell(null);
        handleCellChange(rowId, colKey, e.target.value);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleCellChange(rowId, colKey, e.target.value);
        
        if (e.shiftKey) {
          if (currentColIndex > 0) {
            setEditingCell({ row: rowId, col: COLUMNS[currentColIndex - 1].key });
          } else if (currentRowIndex > 0) {
            setEditingCell({ row: expensesList[currentRowIndex - 1].id, col: COLUMNS[COLUMNS.length - 1].key });
          }
        } else {
          if (currentColIndex < COLUMNS.length - 1) {
            setEditingCell({ row: rowId, col: COLUMNS[currentColIndex + 1].key });
          } else if (currentRowIndex < expensesList.length - 1) {
            setEditingCell({ row: expensesList[currentRowIndex + 1].id, col: COLUMNS[0].key });
          }
        }
      }
  };

  const renderCellContent = (expense, col) => {
      if (col.key === 'created_date') {
          return <span className="text-slate-600 font-medium">{expense.created_date ? new Date(expense.created_date).toLocaleDateString('he-IL') : '-'}</span>;
      }

      const isEventField = ['event_name', 'event_date', 'buyers_count', 'scanned_count'].includes(col.key);
      let value = expense[col.key];
      
      if (isEventField) {
          const event = eventsMap[expense.id];
          value = event ? event[col.key] : null;
      }

      if (value === null || value === undefined || value === '') {
          return <span className="text-slate-400">—</span>;
      }
      return value;
  };

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="w-full max-w-[98%] mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Receipt className="w-8 h-8 text-slate-600" />
          <h1 className="text-3xl font-light text-slate-800 tracking-tight">
            כל ההוצאות
          </h1>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="חיפוש לפי מקבל, סיבה, אירוע..."
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

            {/* Reason Filter */}
            <Select 
              value={filters.reason} 
              onValueChange={(val) => setFilters(prev => ({ ...prev, reason: val }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="סינון לפי סיבה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסיבות</SelectItem>
                {COLUMNS.find(c => c.key === 'reason')?.options?.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Recipient Filter */}
            <Select 
              value={filters.recipient} 
              onValueChange={(val) => setFilters(prev => ({ ...prev, recipient: val }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="סינון לפי מקבל" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המקבלים</SelectItem>
                {uniqueRecipients.map(recipient => (
                  <SelectItem key={recipient} value={recipient}>{recipient}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {(searchQuery || filters.startDate || filters.endDate || filters.reason !== 'all' || filters.recipient !== 'all') && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ startDate: null, endDate: null, reason: 'all', recipient: 'all' });
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
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Receipt className="w-12 h-12 mb-4" />
              <p className="text-lg">לא נמצאו הוצאות תואמות לחיפוש</p>
              <Button 
                variant="link" 
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ startDate: null, endDate: null, reason: 'all', recipient: 'all' });
                }}
              >
                נקה סינונים
              </Button>
            </div>
          ) : (
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/80">
                  {COLUMNS.map((col) => (
                      <th key={col.key} className="px-4 py-4 text-right text-xs font-medium text-slate-500 border-b border-slate-200/60 whitespace-nowrap">
                          {col.label}
                      </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => {
                  const event = eventsMap[expense.id] || {};

                  return (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                    {COLUMNS.map((col) => {
                        const isRecipientSelect = col.key === 'recipient' && (expense.reason === 'תשלום לספק' || expense.reason === 'משיכה לאדם' || expense.reason === 'החזר מלא' || expense.reason === 'החזר חלקי');
                        const isSelect = col.type === 'select' || isRecipientSelect;
                        const isEditable = col.type !== 'readonly';

                        const isEventField = ['event_name', 'event_date', 'buyers_count', 'scanned_count'].includes(col.key);
                        const cellValue = isEventField ? event[col.key] : expense[col.key];

                        return (
                        <td key={col.key} className="px-2 py-2 text-sm border-b border-slate-100 last:border-b-0">
                            {editingCell?.row === expense.id && editingCell?.col === col.key && isEditable ? (
                                isSelect ? (
                                    <Select 
                                        defaultValue={cellValue} 
                                        onValueChange={(val) => {
                                            handleCellChange(expense.id, col.key, val);
                                            setEditingCell(null);
                                        }}
                                        defaultOpen={true}
                                    >
                                      <SelectTrigger className="h-9 w-full border-slate-300 focus:border-slate-500 focus:ring-slate-500" dir="rtl">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent dir="rtl">
                                        {col.key === 'currency' ? (
                                          <>
                                            <SelectItem value="ILS">₪ ILS</SelectItem>
                                            <SelectItem value="USD">$ USD</SelectItem>
                                            <SelectItem value="EUR">€ EUR</SelectItem>
                                          </>
                                        ) : isRecipientSelect ? (
                                          (expense.reason === 'משיכה לאדם' || expense.reason === 'החזר מלא' || expense.reason === 'החזר חלקי') ? (
                                              users.map(u => (
                                                  <SelectItem key={u.id} value={u.full_name}>{u.full_name}</SelectItem>
                                              ))
                                          ) : (
                                              <>
                                                  <SelectItem value="מנוס">מנוס</SelectItem>
                                                  <SelectItem value="טמיס">טמיס</SelectItem>
                                                  <SelectItem value="מייק">מייק</SelectItem>
                                                  <SelectItem value="מגדה">מגדה</SelectItem>
                                              </>
                                          )
                                        ) : (
                                          col.options?.map(opt => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                          ))
                                        )}
                                      </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        autoFocus
                                        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                        defaultValue={cellValue}
                                        onBlur={(e) => {
                                            handleCellBlur(e);
                                            const originalValue = cellValue || '';
                                            if (e.target.value !== String(originalValue)) {
                                                handleCellChange(expense.id, col.key, e.target.value);
                                            }
                                        }}
                                        onKeyDown={(e) => handleKeyDown(e, expense.id, col.key)}
                                        className="h-9 border-slate-300 focus:border-slate-500 focus:ring-slate-500 text-right"
                                    />
                                )
                            ) : (
                                <div 
                                    className={`px-4 py-2 min-h-[36px] rounded-lg transition-colors flex items-center ${isEditable ? 'cursor-text hover:bg-slate-100' : 'cursor-default text-slate-300'}`}
                                    onMouseDown={(e) => {
                                        if (!isEditable) return;
                                        e.preventDefault();
                                        setEditingCell({ row: expense.id, col: col.key });
                                    }}
                                >
                                    {renderCellContent(expense, col)}
                                </div>
                            )}
                        </td>
                    )})}
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}