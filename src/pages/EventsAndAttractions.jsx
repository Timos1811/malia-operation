import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Ticket, Plus, Trash2, Save, X, Pencil, Building2, Truck, AlertCircle, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Components ---

const SimpleEntityManager = ({ entityName, title, icon: Icon, placeholder }) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [editItemName, setEditItemName] = useState('');

  // Fetch
  const { data: items = [], isLoading } = useQuery({
    queryKey: [entityName],
    queryFn: () => base44.entities[entityName].list('-created_date'),
  });

  // Create
  const createMutation = useMutation({
    mutationFn: (name) => base44.entities[entityName].create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityName] });
      setNewItemName('');
      setIsAdding(false);
      toast.success(`${title} נוסף בהצלחה`);
    },
    onError: () => toast.error(`שגיאה בהוספת ${title}`),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, name }) => base44.entities[entityName].update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityName] });
      setEditingId(null);
      toast.success(`${title} עודכן בהצלחה`);
    },
    onError: () => toast.error(`שגיאה בעדכון ${title}`),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities[entityName].delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityName] });
      toast.success(`${title} נמחק בהצלחה`);
    },
    onError: () => toast.error(`שגיאה במחיקת ${title}`),
  });

  const handleAdd = () => {
    if (!newItemName.trim()) return toast.error('נא להזין שם');
    createMutation.mutate(newItemName);
  };

  const handleUpdate = () => {
    if (!editItemName.trim()) return toast.error('נא להזין שם');
    updateMutation.mutate({ id: editingId, name: editItemName });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditItemName(item.name);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2 text-slate-700">
          <Icon className="w-5 h-5" /> ניהול {title}
        </h3>
        <Button 
            onClick={() => setIsAdding(true)} 
            size="sm"
            className="gap-2 bg-slate-800 hover:bg-slate-900"
            disabled={isAdding}
        >
            <Plus className="w-4 h-4" />
            הוסף {title}
        </Button>
      </div>

      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="text-right font-bold">שם {title}</TableHead>
            <TableHead className="text-center font-bold w-32">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isAdding && (
            <TableRow className="bg-blue-50/50">
              <TableCell>
                <Input
                  placeholder={placeholder}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="bg-white"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
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

          {isLoading ? (
             <TableRow>
                <TableCell colSpan={2} className="text-center py-8 text-slate-500">טוען נתונים...</TableCell>
             </TableRow>
          ) : items.length === 0 && !isAdding ? (
            <TableRow>
               <TableCell colSpan={2} className="text-center py-8 text-slate-500">אין נתונים להצגה</TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id} className="hover:bg-slate-50/50">
                {editingId === item.id ? (
                  <>
                    <TableCell>
                      <Input
                        value={editItemName}
                        onChange={(e) => setEditItemName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
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
  );
};

const ComboManager = ({ attractions }) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', price_eur: '', attractions: [] });
  const [editItem, setEditItem] = useState({ name: '', price_eur: '', attractions: [] });

  const { data: combos = [], isLoading } = useQuery({
    queryKey: ['combos'],
    queryFn: () => base44.entities.Combo.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Combo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      setNewItem({ name: '', price_eur: '', attractions: [] });
      setIsAdding(false);
      toast.success('קומבו נוסף בהצלחה');
    },
    onError: () => toast.error('שגיאה בהוספת קומבו'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Combo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      setEditingId(null);
      toast.success('קומבו עודכן בהצלחה');
    },
    onError: () => toast.error('שגיאה בעדכון קומבו'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Combo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      toast.success('קומבו נמחק בהצלחה');
    },
    onError: () => toast.error('שגיאה במחיקת קומבו'),
  });

  const handleAdd = () => {
    if (!newItem.name || !newItem.price_eur || newItem.attractions.length === 0) {
      return toast.error('נא למלא שם, מחיר ולבחור לפחות אירוע אחד');
    }
    createMutation.mutate({
      name: newItem.name,
      price_eur: parseFloat(newItem.price_eur),
      attractions: newItem.attractions
    });
  };

  const handleUpdate = () => {
    if (!editItem.name || !editItem.price_eur || editItem.attractions.length === 0) {
      return toast.error('נא למלא שם, מחיר ולבחור לפחות אירוע אחד');
    }
    updateMutation.mutate({
      id: editingId,
      data: {
        name: editItem.name,
        price_eur: parseFloat(editItem.price_eur),
        attractions: editItem.attractions
      }
    });
  };

  const startEdit = (combo) => {
    setEditingId(combo.id);
    setEditItem({
      name: combo.name,
      price_eur: combo.price_eur,
      attractions: combo.attractions || []
    });
  };

  const toggleAttraction = (attractionId, isEditing) => {
    if (isEditing) {
      setEditItem(prev => {
        const atts = prev.attractions || [];
        return { ...prev, attractions: atts.includes(attractionId) ? atts.filter(id => id !== attractionId) : [...atts, attractionId] };
      });
    } else {
      setNewItem(prev => {
        const atts = prev.attractions || [];
        return { ...prev, attractions: atts.includes(attractionId) ? atts.filter(id => id !== attractionId) : [...atts, attractionId] };
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">חבילות וקומבואים נוספים (למשל קומבו ערב)</h3>
            <p className="text-xs text-slate-500">ניתן להגדיר שילובים נוספים של אירועים במחיר מיוחד</p>
          </div>
        </div>
        <Button onClick={() => setIsAdding(true)} size="sm" className="gap-2 bg-slate-800 hover:bg-slate-900" disabled={isAdding}>
          <Plus className="w-4 h-4" /> הוסף חבילה
        </Button>
      </div>
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="text-right font-bold w-[25%]">שם הקומבו</TableHead>
            <TableHead className="text-right font-bold w-[40%]">אירועים כלולים</TableHead>
            <TableHead className="text-right font-bold w-[15%]">מחיר (€)</TableHead>
            <TableHead className="text-center font-bold w-[20%]">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isAdding && (
            <TableRow className="bg-blue-50/50">
              <TableCell>
                <Input placeholder="שם הקומבו (לדוג׳ קומבו ערב)" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="bg-white" autoFocus />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {attractions.map(att => (
                    <Badge 
                      key={att.id} 
                      onClick={() => toggleAttraction(att.id, false)}
                      className={`cursor-pointer ${newItem.attractions.includes(att.id) ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                    >
                      {att.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Input type="number" placeholder="0.00" value={newItem.price_eur} onChange={(e) => setNewItem({ ...newItem, price_eur: e.target.value })} className="bg-white" />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" onClick={handleAdd} className="bg-green-600 hover:bg-green-700"><Save className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}><X className="w-4 h-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {isLoading ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">טוען נתונים...</TableCell></TableRow>
          ) : combos.length === 0 && !isAdding ? (
            <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">לא הוגדרו קומבואים נוספים</TableCell></TableRow>
          ) : (
            combos.map((item) => (
              <TableRow key={item.id} className="hover:bg-slate-50/50">
                {editingId === item.id ? (
                  <>
                    <TableCell><Input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {attractions.map(att => (
                          <Badge 
                            key={att.id} 
                            onClick={() => toggleAttraction(att.id, true)}
                            className={`cursor-pointer ${editItem.attractions.includes(att.id) ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                          >
                            {att.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell><Input type="number" value={editItem.price_eur} onChange={(e) => setEditItem({ ...editItem, price_eur: e.target.value })} /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button size="sm" onClick={handleUpdate} className="bg-green-600 hover:bg-green-700"><Save className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium text-slate-800">{item.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(item.attractions || []).map(id => {
                          const att = attractions.find(a => a.id === id);
                          return att ? <Badge key={id} variant="outline" className="bg-white">{att.name}</Badge> : null;
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-lg font-bold text-slate-800">€{item.price_eur?.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(item)} className="h-8 w-8 text-slate-500 hover:text-blue-600"><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} className="h-8 w-8 text-slate-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
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
  );
};

// --- Main Page ---

export default function EventsAndAttractions() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // New Item State (Attractions)
  const [newItem, setNewItem] = useState({ name: '', price_eur: '', cost_price_eur: '', event_days: [], start_time: '20:00' });
  
  // Edit Item State (Attractions)
  const [editItem, setEditItem] = useState({ name: '', price_eur: '', cost_price_eur: '', event_days: [], start_time: '20:00' });

  // Fetch Attractions
  const { data: attractions = [], isLoading } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list('-created_date'),
  });

  // Fetch Combo Price Setting
  const { data: comboSetting } = useQuery({
    queryKey: ['appSettings', 'combo_price_eur'],
    queryFn: async () => {
        const settings = await base44.entities.AppSetting.filter({ key: 'combo_price_eur' });
        return settings[0] || { value: '550' }; // Default fallback
    }
  });

  const [comboPriceInput, setComboPriceInput] = useState('');

  // Update Combo Price Mutation
  const updateComboMutation = useMutation({
    mutationFn: async (newValue) => {
        const settings = await base44.entities.AppSetting.filter({ key: 'combo_price_eur' });
        if (settings.length > 0) {
            return base44.entities.AppSetting.update(settings[0].id, { value: newValue.toString() });
        } else {
            return base44.entities.AppSetting.create({ 
                key: 'combo_price_eur', 
                value: newValue.toString(), 
                description: 'מחיר עסקת קומבו (חבילת הכל כלול) באירו' 
            });
        }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings', 'combo_price_eur'] });
      toast.success('מחיר קומבו עודכן בהצלחה');
      setComboPriceInput(''); // Clear input on success
    },
    onError: () => toast.error('שגיאה בעדכון מחיר קומבו'),
  });

  const handleUpdateComboPrice = () => {
      if (!comboPriceInput || isNaN(parseFloat(comboPriceInput))) {
          toast.error('נא להזין מחיר תקין');
          return;
      }
      updateComboMutation.mutate(comboPriceInput);
  };

  // Create Mutation (Attractions)
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

  // Update Mutation (Attractions)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Attraction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attractions'] });
      setEditingId(null);
      toast.success('אירוע עודכן בהצלחה');
    },
    onError: () => toast.error('שגיאה בעדכון אירוע'),
  });

  // Delete Mutation (Attractions)
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
      cost_price_eur: newItem.cost_price_eur ? parseFloat(newItem.cost_price_eur) : 0,
      event_days: newItem.event_days || [],
      start_time: newItem.start_time || '20:00'
    });
  };

  const startEdit = (attraction) => {
    setEditingId(attraction.id);
    setEditItem({ 
      name: attraction.name, 
      price_eur: attraction.price_eur,
      cost_price_eur: attraction.cost_price_eur || '',
      event_days: attraction.event_days || [],
      start_time: attraction.start_time || '20:00'
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
        cost_price_eur: editItem.cost_price_eur ? parseFloat(editItem.cost_price_eur) : 0,
        event_days: editItem.event_days || [],
        start_time: editItem.start_time || '20:00'
      }
    });
  };

  const DAYS = [
    { id: 0, label: 'א' },
    { id: 1, label: 'ב' },
    { id: 2, label: 'ג' },
    { id: 3, label: 'ד' },
    { id: 4, label: 'ה' },
    { id: 5, label: 'ו' },
    { id: 6, label: 'ש' },
  ];

  const toggleDay = (dayId, isEditing) => {
    if (isEditing) {
      setEditItem(prev => {
        const days = prev.event_days || [];
        if (days.includes(dayId)) {
          return { ...prev, event_days: days.filter(d => d !== dayId) };
        } else {
          return { ...prev, event_days: [...days, dayId].sort() };
        }
      });
    } else {
      setNewItem(prev => {
        const days = prev.event_days || [];
        if (days.includes(dayId)) {
          return { ...prev, event_days: days.filter(d => d !== dayId) };
        } else {
          return { ...prev, event_days: [...days, dayId].sort() };
        }
      });
    }
  };

  return (
    <div className="p-4 md:p-8 text-right bg-slate-50 min-h-screen" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <Ticket className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
                <h1 className="text-3xl font-black text-slate-800">ניהול נתונים</h1>
                <p className="text-slate-500">ניהול אירועים, מלונות וספקים במערכת</p>
            </div>
        </div>

        <Tabs defaultValue="events" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-white border shadow-sm rounded-xl mb-6">
                <TabsTrigger value="events" className="gap-2 py-3 rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                    <Ticket className="w-4 h-4" /> אירועים ואטרקציות
                </TabsTrigger>
                <TabsTrigger value="hotels" className="gap-2 py-3 rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                    <Building2 className="w-4 h-4" /> בתי מלון
                </TabsTrigger>
                <TabsTrigger value="suppliers" className="gap-2 py-3 rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                    <Truck className="w-4 h-4" /> ספקים
                </TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                 {/* Combo Price Management */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="bg-yellow-100 p-2.5 rounded-lg text-yellow-700 shrink-0">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-slate-800">מחיר קומבו כללי (כל האירועים)</div>
                            <div className="text-sm text-slate-500">מחיר כולל במצב בו לקוח רוכש את כל האירועים המוגדרים</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-100 w-full md:w-auto justify-between md:justify-start">
                        <div className="text-xl font-black text-slate-900 px-2">
                            €{comboSetting?.value || '550'}
                        </div>
                        <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
                        <div className="flex items-center gap-2">
                            <Input 
                                type="number" 
                                placeholder="מחיר חדש..." 
                                className="w-28 h-9 bg-white"
                                value={comboPriceInput}
                                onChange={(e) => setComboPriceInput(e.target.value)}
                            />
                            <Button 
                                size="sm" 
                                className="bg-slate-900 hover:bg-slate-800"
                                onClick={handleUpdateComboPrice}
                                disabled={!comboPriceInput}
                            >
                                עדכן
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Additional Combos Management */}
                <ComboManager attractions={attractions} />

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700">רשימת אירועים</h3>
                        <Button 
                            onClick={() => setIsAdding(true)} 
                            size="sm"
                            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                            disabled={isAdding}
                        >
                            <Plus className="w-4 h-4" />
                            הוסף אירוע
                        </Button>
                    </div>
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right font-bold w-[25%]">שם אירוע</TableHead>
                        <TableHead className="text-right font-bold w-[20%]">ימי ושעת האירוע</TableHead>
                        <TableHead className="text-right font-bold w-[15%]">מחיר עלות (€)</TableHead>
                        <TableHead className="text-right font-bold w-[15%]">מחיר ללקוח (€)</TableHead>
                        <TableHead className="text-center font-bold w-[20%]">פעולות</TableHead>
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
                            <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-1">
                              {DAYS.map(day => (
                                <div
                                  key={day.id}
                                  onClick={() => toggleDay(day.id, false)}
                                  className={`
                                    cursor-pointer w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border transition-colors select-none
                                    ${(newItem.event_days || []).includes(day.id) 
                                      ? 'bg-indigo-600 text-white border-indigo-600' 
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}
                                  `}
                                >
                                  {day.label}
                                </div>
                              ))}
                            </div>
                            <Input
                                type="time"
                                value={newItem.start_time}
                                onChange={(e) => setNewItem({ ...newItem, start_time: e.target.value })}
                                className="bg-white h-7 text-xs w-24"
                            />
                            </div>
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
                          <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                            טוען נתונים...
                          </TableCell>
                        </TableRow>
                      ) : attractions.length === 0 && !isAdding ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-500">
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
                                  <div className="flex flex-col gap-2">
                                  <div className="flex flex-wrap gap-1">
                                    {DAYS.map(day => (
                                      <div
                                        key={day.id}
                                        onClick={() => toggleDay(day.id, true)}
                                        className={`
                                          cursor-pointer w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border transition-colors select-none
                                          ${(editItem.event_days || []).includes(day.id) 
                                            ? 'bg-indigo-600 text-white border-indigo-600' 
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}
                                        `}
                                      >
                                        {day.label}
                                      </div>
                                    ))}
                                    </div>
                                    <Input
                                      type="time"
                                      value={editItem.start_time || ''}
                                      onChange={(e) => setEditItem({ ...editItem, start_time: e.target.value })}
                                      className="bg-white h-7 text-xs w-24"
                                    />
                                    </div>
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
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap gap-1">
                                    {(item.event_days && item.event_days.length > 0) ? (
                                      item.event_days.sort().map(dayId => (
                                        <Badge key={dayId} variant="secondary" className="px-1.5 py-0 text-[10px] h-5 min-w-[1.25rem] justify-center bg-slate-100 text-slate-600 border-slate-200">
                                          {DAYS.find(d => d.id === dayId)?.label}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-slate-400 text-xs">-</span>
                                    )}
                                    </div>
                                    {item.start_time && (
                                      <div className="text-xs text-slate-500">
                                          שעה: {item.start_time}
                                      </div>
                                    )}
                                    </div>
                                    </TableCell>
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
            </TabsContent>

            <TabsContent value="hotels" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <SimpleEntityManager 
                    entityName="Hotel" 
                    title="בית מלון" 
                    icon={Building2} 
                    placeholder="שם המלון..." 
                />
            </TabsContent>

            <TabsContent value="suppliers" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <SimpleEntityManager 
                    entityName="Supplier" 
                    title="ספק" 
                    icon={Truck} 
                    placeholder="שם הספק..." 
                />
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}