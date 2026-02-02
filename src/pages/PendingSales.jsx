import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const COLUMNS = [
  { key: 'order_number', label: 'מספר הזמנה' },
  { key: 'departure_date', label: 'תאריך עזיבה' },
  { key: 'customer', label: 'לקוחות' },
  { key: 'nights', label: 'לילות' },
  { key: 'gender', label: 'מגדר' },
  { key: 'hotel', label: 'מלון' },
  { key: 'company', label: 'חברה' },
  { key: 'requested_amount', label: 'סכום מבוקש' },
  { key: 'eur_amount', label: 'EUR' },
];

export default function PendingSales() {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState(null);

  // Fetch pending sales
  const { data: pendingSales = [], isLoading } = useQuery({
    queryKey: ['pendingSales'],
    queryFn: () => base44.entities.PendingSale.list(),
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (sale) => {
      // 1. Create in TableData (Actual Income)
      // Remove system fields (id, created_at, etc) and prepare for TableData
      const { id, created_at, updated_at, created_by, updated_by, ...saleData } = sale;
      
      // Calculate status if needed, similar to Table.jsx logic
      // For now, we trust the eur_status or recalculate it? 
      // Table.jsx calculates it on save. Let's do a simple calculation or keep as is.
      // The NewSale page sets eur_status to "0".
      
      const eur = parseFloat(saleData.eur_amount) || 0;
      const req = parseFloat(saleData.requested_amount) || 0;
      // Assuming simple calculation for status if 0
      let calculatedStatus = saleData.eur_status;
      if (calculatedStatus === "0" || !calculatedStatus) {
         const diff = eur - req; // Simplified check (ignoring other currencies for now as NewSale mainly sets EUR)
         calculatedStatus = Math.abs(diff) < 0.01 ? 'מאוזן' : diff.toFixed(2);
      }

      await base44.entities.TableData.create({
        ...saleData,
        eur_status: calculatedStatus
      });

      // 2. Delete from PendingSale
      await base44.entities.PendingSale.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingSales']);
      toast.success("ההזמנה אושרה והועברה להכנסות");
      setProcessingId(null);
    },
    onError: () => {
      toast.error("שגיאה באישור ההזמנה");
      setProcessingId(null);
    }
  });

  // Reject/Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.PendingSale.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingSales']);
      toast.success("ההזמנה נמחקה");
      setProcessingId(null);
    },
    onError: () => {
      toast.error("שגיאה במחיקת ההזמנה");
      setProcessingId(null);
    }
  });

  const handleApprove = (sale) => {
    setProcessingId(sale.id);
    approveMutation.mutate(sale);
  };

  const handleDelete = (id) => {
    if (confirm('האם אתה בטוח שברצונך למחוק הזמנה זו?')) {
      setProcessingId(id);
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                <Clock className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">הכנסות ממתינות לאישור</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              טוען נתונים...
            </div>
          ) : pendingSales.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              אין הכנסות ממתינות לאישור כרגע.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="px-6 py-4 text-xs font-bold text-slate-500 text-right uppercase tracking-wider">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center uppercase tracking-wider">
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                           {col.key === 'requested_amount' || col.key === 'eur_amount' ? '€' : ''}
                           {sale[col.key]}
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white gap-1 shadow-sm"
                            onClick={() => handleApprove(sale)}
                            disabled={processingId === sale.id}
                          >
                            {processingId === sale.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            אשר
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1 shadow-sm"
                            onClick={() => handleDelete(sale.id)}
                            disabled={processingId === sale.id}
                          >
                            <XCircle className="w-4 h-4" />
                            מחק
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}