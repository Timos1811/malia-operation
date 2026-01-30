import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Ticket, Plus, Trash2, Save, X, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function EventsAndAttractions() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // New Item State
  const [newItem, setNewItem] = useState({ name: '', price_eur: '', cost_price_eur: '' });
  
  // Edit Item State
  const [editItem, setEditItem] = useState({ name: '', price_eur: '', cost_price_eur: '' });

  // Fetch Attractions
  const { data: attractions = [], isLoading } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list('-created_date'),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Attraction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attractions'] });
      setNewItem({ name: '', price_eur: '' });
      setIsAdding(false);
      toast.success('אירוע נוסף בהצלחה');
    },
    onError: () => toast.error('שגיאה בהוספת אירוע'),
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Attraction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attractions'] });
      setEditingId(null);
      toast.success('אירוע עודכן בהצלחה');
    },
    onError: () => toast.error('שגיאה בעדכון אירוע'),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Attraction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attractions'] });
      toast.success('אירוע נמחק בהצלחה');
    },
    onError: () => toast.error('שגיאה במחיקת אירוע'),
  });

  const handleAdd = () => {
    if (!newItem.name || !newItem.price_eur) {
      toast.error('נא למלא את כל השדות (שם ומחיר ללקוח)');
      return;
    }
    createMutation.mutate({
      name: newItem.name,
      price_eur: parseFloat(newItem.price_eur),
      cost_price_eur: newItem.cost_price_eur ? parseFloat(newItem.cost_price_eur) : 0
    });
  };

  const startEdit = (attraction) => {
    setEditingId(attraction.id);
    setEditItem({ 
      name: attraction.name, 
      price_eur: attraction.price_eur,
      cost_price_eur: attraction.cost_price_eur || ''
    });
  };

  const handleUpdate = () => {
    if (!editItem.name || !editItem.price_eur) {
      toast.error('נא למלא את כל השדות (שם ומחיר ללקוח)');
      return;
    }
    updateMutation.mutate({
      id: editingId,
      data: {
        name: editItem.name,
        price_eur: parseFloat(editItem.price_eur),
        cost_price_eur: editItem.cost_price_eur ? parseFloat(editItem.cost_price_eur) : 0
      }
    });
  };

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Ticket className="w-8 h-8 text-slate-600" />
            <h1 className="text-3xl font-bold text-slate-800">אירועים ואטרקציות</h1>
          </div>
          <Button 
            onClick={() => setIsAdding(true)} 
            className="gap-2 bg-slate-800 hover:bg-slate-900"
            disabled={isAdding}
          >
            <Plus className="w-4 h-4" />
            הוסף חדש
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-right font-bold w-1/3">שם אירוע</TableHead>
                <TableHead className="text-right font-bold w-1/4">מחיר עלות (€)</TableHead>
                <TableHead className="text-right font-bold w-1/4">מחיר ללקוח (€)</TableHead>
                <TableHead className="text-center font-bold w-1/6">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Add New Row */}
              {isAdding && (
                <TableRow className="bg-blue-50/50">
                  <TableCell>
                    <Input
                      placeholder="שם האירוע..."
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="bg-white"
                      autoFocus
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newItem.cost_price_eur}
                      onChange={(e) => setNewItem({ ...newItem, cost_price_eur: e.target.value })}
                      className="bg-white"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newItem.price_eur}
                      onChange={(e) => setNewItem({ ...newItem, price_eur: e.target.value })}
                      className="bg-white"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button size="sm" onClick={handleAdd} className="bg-green-600 hover:bg-green-700">
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {/* Data Rows */}
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                    טוען נתונים...
                  </TableCell>
                </TableRow>
              ) : attractions.length === 0 && !isAdding ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                    אין אירועים או אטרקציות ברשימה. הוסף את הראשון!
                  </TableCell>
                </TableRow>
              ) : (
                attractions.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    {editingId === item.id ? (
                      <>
                        <TableCell>
                          <Input
                            value={editItem.name}
                            onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={editItem.cost_price_eur}
                            onChange={(e) => setEditItem({ ...editItem, cost_price_eur: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={editItem.price_eur}
                            onChange={(e) => setEditItem({ ...editItem, price_eur: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" onClick={handleUpdate} className="bg-green-600 hover:bg-green-700">
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-mono text-slate-500">€{item.cost_price_eur?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="font-mono text-lg font-bold text-slate-800">€{item.price_eur?.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button size="icon" variant="ghost" onClick={() => startEdit(item)} className="h-8 w-8 text-slate-500 hover:text-blue-600">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} className="h-8 w-8 text-slate-500 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}