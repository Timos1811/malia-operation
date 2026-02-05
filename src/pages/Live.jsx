import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

export default function Live() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [orderSearch, setOrderSearch] = React.useState('');
  const [filters, setFilters] = React.useState({
    sales_rep: 'all',
    event_name: 'all',
    event_status: 'bought'
  });

  // Fetch Filters Data
  const { data: attractions = [] } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  // Main Data Query
  const { data: tableData = [], isLoading } = useQuery({
    queryKey: ['tableData', filters],
    queryFn: async () => {
      // Use the search backend function
      const response = await base44.functions.invoke('searchGroups', filters);
      return response.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const clearFilters = () => {
    setFilters({
        sales_rep: 'all',
        event_name: 'all',
        event_status: 'bought'
    });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, departure_sent }) => base44.entities.TableData.update(id, { departure_sent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tableData'] });
      toast.success('סטטוס עזיבה עודכן');
    },
    onError: () => {
      toast.error('שגיאה בעדכון סטטוס');
    }
  });

  const handleDepartureSentChange = (id, checked) => {
    updateMutation.mutate({ id, departure_sent: checked });
  };

  const liveGroups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tableData
      .map(row => {
        if (!row.departure_date || !row.order_number) return null;
        
        let departureDate = null;
        const dateStr = row.departure_date.trim();

        // Handle YYYY-MM-DD
        if (dateStr.includes('-')) {
             const parts = dateStr.split('-');
             if (parts.length === 3) {
                 const year = parseInt(parts[0], 10);
                 const month = parseInt(parts[1], 10) - 1;
                 const day = parseInt(parts[2], 10);
                 departureDate = new Date(year, month, day);
             }
        }
        // Handle DD/MM/YYYY
        else if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length >= 2) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1;
              let year = today.getFullYear();
              
              if (parts.length === 3) {
                 year = parseInt(parts[2], 10);
                 if (year < 100) year += 2000;
              }
    
              departureDate = new Date(year, month, day);
            }
        }

        if (departureDate && isNaN(departureDate.getTime())) return null;

        if (!departureDate) return null;

        return { ...row, parsedDepartureDate: departureDate };
      })
      .filter(row => row && today <= row.parsedDepartureDate);
  }, [tableData]);

  const stats = useMemo(() => {
    let totalCustomers = 0;
    const genderDist = {};
    
    liveGroups.forEach(g => {
      // User specified to use the number in the customer column
      const count = parseInt(g.customer) || 0;
      totalCustomers += count;

      const gender = g.gender ? g.gender.trim() : 'לא צוין';
      genderDist[gender] = (genderDist[gender] || 0) + count;
    });

    const chartData = Object.entries(genderDist).map(([name, value]) => ({ name, value }));

    return {
      total: totalCustomers,
      genderDist,
      chartData
    };
  }, [liveGroups]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 text-right" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-slate-600" />
            <h1 className="text-3xl font-bold text-slate-800">לייב - קבוצות ביעד</h1>
        </div>

        {/* Search & Filters */}
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    חיפוש וסינון
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-6">
                    {/* Order Search */}
                    <div className="flex gap-2 items-end border-b pb-6">
                        <div className="space-y-2 flex-1 max-w-sm">
                            <label className="text-sm font-medium text-slate-700">חיפוש לפי מספר הזמנה</label>
                            <div className="relative">
                                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                                <Input 
                                    value={orderSearch}
                                    onChange={(e) => setOrderSearch(e.target.value)}
                                    placeholder="הזן מספר הזמנה..."
                                    className="pr-9"
                                    onKeyDown={(e) => e.key === 'Enter' && orderSearch && navigate(`${createPageUrl('OrderDetails')}?orderNumber=${orderSearch}`)}
                                />
                            </div>
                        </div>
                        <Button 
                            onClick={() => orderSearch && navigate(`${createPageUrl('OrderDetails')}?orderNumber=${orderSearch}`)}
                            disabled={!orderSearch}
                        >
                            חפש הזמנה
                        </Button>
                    </div>

                    {/* Advanced Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">נציג מכירות</label>
                        <Select 
                            value={filters.sales_rep} 
                            onValueChange={(val) => setFilters(prev => ({ ...prev, sales_rep: val }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="כל הנציגים" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">כל הנציגים</SelectItem>
                                {users.map(u => (
                                    <SelectItem key={u.id} value={u.full_name}>{u.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">אירוע / מסיבה</label>
                        <Select 
                            value={filters.event_name} 
                            onValueChange={(val) => setFilters(prev => ({ ...prev, event_name: val }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="בחר אירוע" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">הכל</SelectItem>
                                {attractions.map(a => (
                                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">סטטוס רכישה</label>
                        <Select 
                            value={filters.event_status} 
                            onValueChange={(val) => setFilters(prev => ({ ...prev, event_status: val }))}
                            disabled={filters.event_name === 'all'}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="סטטוס" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bought">רכשו את האירוע</SelectItem>
                                <SelectItem value="not_bought">לא רכשו</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button 
                        variant="outline" 
                        onClick={clearFilters}
                        className="w-full"
                    >
                        <X className="w-4 h-4 ml-2" />
                        נקה סינון
                    </Button>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">סה״כ לקוחות ביעד</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl font-bold text-slate-800">{stats.total}</div>
                </CardContent>
            </Card>
            <Card className="flex flex-col">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">התפלגות מגדר</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-[200px]">
                    {stats.chartData.length > 0 ? (
                        <div className="w-full h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                            אין נתונים להצגה
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>קבוצות נוכחות ({liveGroups.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {liveGroups.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                    אין קבוצות ביעד כרגע
                </div>
            ) : (
                <div className="rounded-md border">
                <Table>
                    <TableHeader>
                    <TableRow className="bg-slate-50">
                        <TableHead className="text-right">מספר הזמנה</TableHead>
                        <TableHead className="text-right">תאריך עזיבה</TableHead>
                        <TableHead className="text-right">לקוחות</TableHead>
                        <TableHead className="text-right">לילות</TableHead>
                        <TableHead className="text-right">מגדר</TableHead>
                        <TableHead className="text-right">מלון</TableHead>
                        <TableHead className="text-right">חברה</TableHead>
                        <TableHead className="text-center">נשלחה עזיבה</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {liveGroups.map((group) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        // Calculate days difference
                        const timeDiff = group.parsedDepartureDate.getTime() - today.getTime();
                        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        const isUrgent = daysDiff <= 1 && !group.departure_sent;

                        return (
                        <TableRow key={group.id} className={isUrgent ? "bg-red-100 hover:bg-red-200" : ""}>
                        <TableCell className="font-medium">
                            <Link 
                                to={`${createPageUrl('OrderDetails')}?orderNumber=${group.order_number}`}
                                className="text-blue-600 hover:underline"
                            >
                                {group.order_number}
                            </Link>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {group.departure_date}
                            </Badge>
                        </TableCell>
                        <TableCell>{group.customer}</TableCell>
                        <TableCell>{group.nights}</TableCell>
                        <TableCell>{group.gender}</TableCell>
                        <TableCell>{group.hotel}</TableCell>
                        <TableCell>{group.company}</TableCell>
                        <TableCell className="text-center">
                            <div className="flex justify-center">
                                <Checkbox 
                                    checked={group.departure_sent || false}
                                    onCheckedChange={(checked) => handleDepartureSentChange(group.id, checked)}
                                />
                            </div>
                        </TableCell>
                        </TableRow>
                        );
                    })}
                    </TableBody>
                </Table>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}