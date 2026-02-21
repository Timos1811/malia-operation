import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Save, Plus, Trash2, Filter, X, ArrowDownWideNarrow, ArrowUpNarrowWide, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const COLUMNS = [
  'מספר הזמנה', 'תאריך עזיבה', 'לקוחות', 'לילות', 'מגדר', 'מלון', 
  'חברה', 'סכום מבוקש', 'EUR', 'שקל', 'דולר', 'ביט', 'סטטוס בEUR', 'שם נציג', 'הערות', 'מעטפה'
];

const COLUMN_KEYS = [
  'order_number', 'departure_date', 'customer', 'nights', 'gender', 'hotel', 
  'company', 'requested_amount', 'eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount', 'eur_status', 'sales_rep', 'comments', 'envelope_received'
];

function EditableCell({ value, onBlur, disabled, type = 'text' }) {
    const [localValue, setLocalValue] = useState(value);
    
    React.useEffect(() => {
        setLocalValue(value);
    }, [value]);

    return (
        <Input
            type={type}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => onBlur(localValue)}
            className={cn(
                "text-right h-8 text-xs border-transparent bg-transparent transition-all duration-200 font-medium text-slate-700",
                "hover:bg-slate-50 hover:border-slate-200",
                "focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20",
                disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
        />
    );
}

export default function PendingSales() {
  const queryClient = useQueryClient();
  const [editingCell, setEditingCell] = useState(null);
  const [filters, setFilters] = useState({
      salesRep: 'all',
      envelopeStatus: 'all', // 'all', 'received', 'not_received'
      sortOrder: 'newest' // 'newest', 'oldest'
  });
  
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [selectedSaleToMove, setSelectedSaleToMove] = useState(null);
  const [moveAmounts, setMoveAmounts] = useState({
      eur_amount: '',
      shekel_amount: '',
      dollar_amount: '',
      bit_amount: '',
      comments: ''
  });

  // Fetch data from PendingSale entity
  const { data: pendingSales = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['pendingSales'],
    queryFn: () => base44.entities.PendingSale.list(),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PendingSale.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingSales']);
    },
    onError: () => toast.error("שגיאה בעדכון הנתונים")
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PendingSale.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingSales']);
      toast.success("השורה נמחקה");
    },
    onError: () => toast.error("שגיאה במחיקת השורה")
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (newRow) => base44.entities.PendingSale.create(newRow),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingSales']);
      toast.success("שורה חדשה נוספה");
    },
    onError: () => toast.error("שגיאה בהוספת שורה")
  });

  const handleAddRow = () => {
      createMutation.mutate({
          order_number: " ", 
          created_date: new Date().toISOString(),
          requested_amount: "",
          eur_amount: "",
          shekel_amount: "",
          dollar_amount: "",
          bit_amount: "",
          eur_status: "",
          sales_rep: "",
          comments: "",
          envelope_received: false
      });
  };

  const handleCellChange = (id, colKey, value, originalRow) => {
    // Optimistic update logic could go here, but for simplicity we'll just mutate
    // We only trigger update on blur to avoid too many requests, 
    // but here we are in onChange, so let's just update local state if we had it, 
    // or direct update if we want real-time (but real-time on every keystroke is bad).
    // Better pattern: Local state for the input, update on blur.
  };

  const handleBlur = async (id, colKey, value, originalRow) => {
    if (value === originalRow[colKey]) return; // No change

    const updates = { [colKey]: (colKey === 'order_number' && value) ? value.trim() : value };

    // If currency fields changed, recalculate status
    if (['eur_amount', 'shekel_amount', 'dollar_amount', 'bit_amount', 'requested_amount'].includes(colKey)) {
        // We calculate based on the new value and existing values
        const row = { ...originalRow, ...updates };
        const status = calculateStatusText(row);
        updates.eur_status = status;
    }

    // Check if order number changed
    if (colKey === 'order_number' && value && String(value).trim().length > 0) {
        try {
            const trimmedValue = String(value).trim();
            let existingOrders = await base44.entities.TableData.filter({ order_number: trimmedValue });
            
            // Fallback search if not found (handles type mismatches or indexing delays)
            if (existingOrders.length === 0) {
                const recentItems = await base44.entities.TableData.list('-created_date', 1000);
                existingOrders = recentItems.filter(item => String(item.order_number).trim() === trimmedValue);
            }

            if (existingOrders.length > 0) {
                // Use the most recent one if multiple found in fallback
                existingOrders.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
                const existing = existingOrders[0];
                
                const newUpdates = {
                    ...updates,
                    customer: existing.customer,
                    departure_date: existing.departure_date,
                    nights: existing.nights,
                    gender: existing.gender,
                    hotel: existing.hotel,
                    company: existing.company,
                    requested_amount: existing.requested_amount,
                    eur_amount: existing.eur_amount,
                    shekel_amount: existing.shekel_amount,
                    dollar_amount: existing.dollar_amount,
                    bit_amount: existing.bit_amount,
                    eur_status: existing.eur_status,
                    sales_rep: existing.sales_rep || row.sales_rep, // Keep current if empty
                    comments: existing.comments
                };
                updateMutation.mutate({ id, data: newUpdates });
                toast.success("נמצאה הזמנה קיימת - הנתונים נטענו לעריכה");
                setEditingCell(null);
                return;
            }
        } catch (e) {
            console.error("Error checking existing order", e);
        }
    }

    updateMutation.mutate({ id, data: updates });
    setEditingCell(null);
  };

  const handleOpenMoveDialog = (row) => {
      setSelectedSaleToMove(row);
      setMoveAmounts({
          eur_amount: row.eur_amount || '',
          shekel_amount: row.shekel_amount || '',
          dollar_amount: row.dollar_amount || '',
          bit_amount: row.bit_amount || '',
          comments: row.comments || ''
      });
      setIsMoveDialogOpen(true);
  };

  const executeMoveToSales = async () => {
      if (!selectedSaleToMove) return;
      
      const row = {
          ...selectedSaleToMove,
          ...moveAmounts,
          // Recalculate status based on new amounts
          eur_status: calculateStatusText({ ...selectedSaleToMove, ...moveAmounts })
      };

      try {
          // Check for existing order in TableData
          const orderNum = row.order_number ? String(row.order_number).trim() : "";
          let existingOrders = await base44.entities.TableData.filter({ order_number: orderNum });

          // Fallback search if not found (handles type mismatches or indexing delays)
          if (existingOrders.length === 0) {
              const recentItems = await base44.entities.TableData.list('-created_date', 1000);
              existingOrders = recentItems.filter(item => String(item.order_number).trim() === orderNum);
          }
          
          if (existingOrders.length > 0) {
              // Sort by created_date desc to keep the latest
              existingOrders.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
              const existing = existingOrders[0];

              // Delete older duplicates
              if (existingOrders.length > 1) {
                  await Promise.all(existingOrders.slice(1).map(dup => base44.entities.TableData.delete(dup.id)));
              }

              // UPDATE EXISTING (Overwrite/Update)
              await base44.entities.TableData.update(existing.id, {
                  order_number: orderNum,
                  customer: row.customer,
                  departure_date: row.departure_date,
                  nights: row.nights,
                  gender: row.gender,
                  hotel: row.hotel,
                  company: row.company,
                  requested_amount: row.requested_amount,
                  eur_amount: row.eur_amount,
                  shekel_amount: row.shekel_amount,
                  dollar_amount: row.dollar_amount,
                  bit_amount: row.bit_amount,
                  eur_status: row.eur_status,
                  sales_rep: row.sales_rep,
                  comments: row.comments,
                  is_combo: row.is_combo,
                  updated_date: new Date().toISOString()
              });
              
              toast.success(`הזמנה ${row.order_number} עודכנה בהצלחה!`);
          } else {
              // CREATE NEW
              const newRowData = { ...row };
              delete newRowData.id; // Remove PendingSale ID
              delete newRowData.envelope_received; // Remove temporary field
              newRowData.order_number = orderNum;
              newRowData.created_date = new Date().toISOString();
              
              await base44.entities.TableData.create(newRowData);
              toast.success("ההזמנה נשמרה בהצלחה והועברה לטבלת ההכנסות!");
          }

          // Delete from PendingSale
          await base44.entities.PendingSale.delete(row.id); // row.id comes from selectedSaleToMove, which is correct

          // Refresh UI
          queryClient.invalidateQueries(['pendingSales']);
          setIsMoveDialogOpen(false);
          
      } catch (error) {
          console.error(error);
          toast.error("שגיאה בשמירת הנתונים");
      }
  };

  // Helper to calculate status string for DB storage/display
  const calculateStatusText = (row) => {
    const eur = parseFloat(row.eur_amount) || 0;
    const nis = parseFloat(row.shekel_amount) || 0;
    const usd = parseFloat(row.dollar_amount) || 0;
    const bit = parseFloat(row.bit_amount) || 0;
    const req = parseFloat(row.requested_amount) || 0;
    
    const total = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
    
    if (!row.requested_amount) return "0";

    const diff = total - req;
    if (Math.abs(diff) < 0.01) return "מאוזן";
    return diff.toFixed(2);
  };

  const calculateStatusDisplay = (row) => {
    // Re-calculate for display properties (color)
    const eur = parseFloat(row.eur_amount) || 0;
    const nis = parseFloat(row.shekel_amount) || 0;
    const usd = parseFloat(row.dollar_amount) || 0;
    const bit = parseFloat(row.bit_amount) || 0;
    const req = parseFloat(row.requested_amount) || 0;
    
    const total = eur + (nis * 0.26) + (usd * 0.95) + (bit * 0.26);
    
    if (!row.requested_amount) return { text: '—', color: 'bg-slate-100 text-slate-600' };

    const diff = total - req;
    if (Math.abs(diff) < 0.01) return { text: 'מאוזן', color: 'bg-blue-100 text-blue-700' };
    if (diff > 0) return { text: `+${diff.toFixed(2)}`, color: 'bg-green-100 text-green-800' };
    return { text: diff.toFixed(2), color: 'bg-red-100 text-red-800' };
  };

  const handleDeleteRow = (id) => {
    if (window.confirm('האם למחוק שורה זו?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filter Logic
  const uniqueReps = Array.from(new Set(pendingSales.map(s => s.sales_rep).filter(Boolean)));
  
  const filteredSales = pendingSales.filter(sale => {
      // Rep Filter
      if (filters.salesRep !== 'all' && sale.sales_rep !== filters.salesRep) return false;
      
      // Envelope Filter
      if (filters.envelopeStatus === 'received' && !sale.envelope_received) return false;
      if (filters.envelopeStatus === 'not_received' && sale.envelope_received) return false;
      
      return true;
  });

  // Sort Logic
  filteredSales.sort((a, b) => {
      const dateA = new Date(a.created_date || 0);
      const dateB = new Date(b.created_date || 0);
      return filters.sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const clearFilters = () => setFilters({ salesRep: 'all', envelopeStatus: 'all', sortOrder: 'newest' });
  const hasActiveFilters = filters.salesRep !== 'all' || filters.envelopeStatus !== 'all' || filters.sortOrder !== 'newest';

  return (
    <div className="p-4 md:p-6 text-right" dir="rtl">
      <div className="w-full max-w-[98%] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-800">מכירה בהמתנה</h1>
          <div className="flex gap-4 items-center">
            <Button 
              onClick={handleAddRow}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4" /> 
              הוסף מכירה
            </Button>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              className="gap-2"
              disabled={isRefetching}
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} /> 
              {isRefetching ? 'מרענן...' : 'רענן נתונים'}
            </Button>
            <div className="text-slate-500">
              {pendingSales.length} הזמנות ממתינות
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-slate-500 font-medium">
                <Filter className="w-4 h-4" />
                סינון:
            </div>
            
            {/* Sales Rep Filter */}
            <Select 
                value={filters.salesRep} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, salesRep: val }))}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="בחר נציג" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">כל הנציגים</SelectItem>
                    {uniqueReps.map(rep => (
                        <SelectItem key={rep} value={rep}>{rep}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Envelope Status Filter */}
            <Select 
                value={filters.envelopeStatus} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, envelopeStatus: val }))}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="סטטוס מעטפה" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="received">התקבלה</SelectItem>
                    <SelectItem value="not_received">לא התקבלה</SelectItem>
                </SelectContent>
            </Select>

            {/* Sort Order Filter */}
            <Select 
                value={filters.sortOrder} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, sortOrder: val }))}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="מיון לפי תאריך" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="newest">
                        <div className="flex items-center gap-2">
                            <ArrowDownWideNarrow className="w-4 h-4" />
                            מהחדש לישן
                        </div>
                    </SelectItem>
                    <SelectItem value="oldest">
                        <div className="flex items-center gap-2">
                            <ArrowUpNarrowWide className="w-4 h-4" />
                            מהישן לחדש
                        </div>
                    </SelectItem>
                </SelectContent>
            </Select>

            {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1">
                    <X className="w-4 h-4" />
                    נקה סינון
                </Button>
            )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                    {COLUMNS.map((col, i) => (
                    <th key={i} className="px-3 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                        {col}
                    </th>
                    ))}
                    <th className="px-3 py-4 w-[140px]"></th>
                </tr>
                </thead>
            <tbody>
              {isLoading ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      טוען נתונים...
                    </td>
                  </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-slate-500">
                    {pendingSales.length === 0 ? 'אין מכירות בהמתנה כרגע' : 'לא נמצאו תוצאות לסינון זה'}
                  </td>
                </tr>
              ) : (
                filteredSales.map((row) => {
                  const status = calculateStatusDisplay(row);
                  return (
                    <tr key={row.id} className="group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                      {COLUMN_KEYS.map((colKey) => (
                        <td key={colKey} className="px-1 py-1">
                          {colKey === 'order_number' ? (
                             row.is_combo ? (
                                <div className="flex items-center gap-2 px-2">
                                    <span className="font-bold text-slate-700">{row[colKey]}</span>
                                    <span className="text-[10px] bg-gradient-to-r from-yellow-200 to-orange-200 text-yellow-800 px-2 py-0.5 rounded-full font-bold shadow-sm border border-yellow-300/50">
                                        COMBO
                                    </span>
                                </div>
                             ) : (
                                <div className="px-3 font-bold text-slate-700">{row[colKey]}</div>
                             )
                          ) : colKey === 'eur_status' ? (
                            <div className={`mx-2 px-3 py-1.5 rounded-full text-center text-xs font-bold shadow-sm ${status.color}`}>
                              {status.text}
                            </div>
                          ) : colKey === 'envelope_received' ? (
                            <div className="flex justify-center items-center h-full">
                                <Checkbox 
                                    className="w-5 h-5 rounded-md data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                    checked={row.envelope_received || false} 
                                    onCheckedChange={(checked) => handleBlur(row.id, colKey, checked, row)}
                                />
                            </div>
                          ) : (
                            <EditableCell 
                                value={row[colKey] || ''}
                                onBlur={(val) => handleBlur(row.id, colKey, val, row)}
                                disabled={false}
                                type={(colKey === 'customer' || colKey === 'nights' || colKey.includes('amount')) ? 'number' : 'text'}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleOpenMoveDialog(row)}
                              className="bg-green-600 hover:bg-green-700 text-white shadow-sm h-8 px-3"
                            >
                              <Save className="w-4 h-4 ml-1" /> שמור
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteRow(row.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>השלמת מכירה - הזמנה {selectedSaleToMove?.order_number}</DialogTitle>
            <DialogDescription>
              אנא אמת/י את סכומי הכסף שהתקבלו בפועל לפני ההעברה לטבלת המכירות הכללית.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="eur">יורו (EUR)</Label>
                    <Input 
                        id="eur" 
                        type="number" 
                        value={moveAmounts.eur_amount} 
                        onChange={(e) => setMoveAmounts({...moveAmounts, eur_amount: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ils">שקל (ILS)</Label>
                    <Input 
                        id="ils" 
                        type="number" 
                        value={moveAmounts.shekel_amount} 
                        onChange={(e) => setMoveAmounts({...moveAmounts, shekel_amount: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="usd">דולר (USD)</Label>
                    <Input 
                        id="usd" 
                        type="number" 
                        value={moveAmounts.dollar_amount} 
                        onChange={(e) => setMoveAmounts({...moveAmounts, dollar_amount: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bit">ביט (BIT)</Label>
                    <Input 
                        id="bit" 
                        type="number" 
                        value={moveAmounts.bit_amount} 
                        onChange={(e) => setMoveAmounts({...moveAmounts, bit_amount: e.target.value})}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="comments">הערות</Label>
                <Input 
                    id="comments" 
                    value={moveAmounts.comments} 
                    onChange={(e) => setMoveAmounts({...moveAmounts, comments: e.target.value})}
                    placeholder="הערות נוספות..."
                />
            </div>
            <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-600">
                <div className="flex justify-between mb-1">
                    <span>סכום מבוקש:</span>
                    <span className="font-semibold">{selectedSaleToMove?.requested_amount || 0}</span>
                </div>
                <div className="flex justify-between">
                    <span>סטטוס צפוי:</span>
                    <span className={cn(
                        "font-bold",
                        calculateStatusText({ ...selectedSaleToMove, ...moveAmounts }) === "מאוזן" ? "text-blue-600" :
                        parseFloat(calculateStatusText({ ...selectedSaleToMove, ...moveAmounts })) > 0 ? "text-green-600" : "text-red-600"
                    )}>
                        {calculateStatusText({ ...selectedSaleToMove, ...moveAmounts })}
                    </span>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>ביטול</Button>
            <Button onClick={executeMoveToSales} className="bg-green-600 hover:bg-green-700">אשר והעבר</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}