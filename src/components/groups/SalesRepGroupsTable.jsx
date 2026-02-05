import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Plane, History } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

export default function SalesRepGroupsTable({ salesRepName }) {
  const queryClient = useQueryClient();
  const [showLiveOnly, setShowLiveOnly] = useState(true);

  // Main Data Query filtered by salesRepName
  const { data: tableData = [], isLoading } = useQuery({
    queryKey: ['tableData', salesRepName],
    queryFn: async () => {
        if (!salesRepName) return [];
        // Directly filter TableData entity for the sales rep
        const response = await base44.entities.TableData.filter({ sales_rep: salesRepName }, '-created_date', 1000);
        return response;
    },
    enabled: !!salesRepName,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

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

  const filteredGroups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const processedData = tableData
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
      .filter(row => row); // Filter out nulls

      if (showLiveOnly) {
          return processedData.filter(row => today <= row.parsedDepartureDate);
      }
      return processedData;
  }, [tableData, showLiveOnly]);

  const stats = useMemo(() => {
    let totalCustomers = 0;
    const genderDist = {};
    
    filteredGroups.forEach(g => {
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
  }, [filteredGroups]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Toggle Buttons */}
        <div className="flex justify-end">
             <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                 <Button 
                    variant={!showLiveOnly ? "default" : "ghost"}
                    size="sm"
                    className={`rounded-lg transition-all ${!showLiveOnly ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    onClick={() => setShowLiveOnly(false)}
                 >
                    <History className="w-4 h-4 ml-2" />
                    כל ההיסטוריה
                 </Button>
                 <Button 
                    variant={showLiveOnly ? "default" : "ghost"}
                    size="sm"
                    className={`rounded-lg transition-all ${showLiveOnly ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    onClick={() => setShowLiveOnly(true)}
                 >
                    <Plane className="w-4 h-4 ml-2" />
                    לייב (ביעד)
                 </Button>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">
                        {showLiveOnly ? 'סה״כ לקוחות ביעד' : 'סה״כ לקוחות (היסטוריה)'}
                    </CardTitle>
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
            <CardTitle className="flex justify-between items-center">
                <span>{showLiveOnly ? 'קבוצות נוכחות (ביעד)' : 'היסטוריית קבוצות'}</span>
                <Badge variant="secondary" className="text-base px-3">{filteredGroups.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredGroups.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                    {showLiveOnly ? 'אין קבוצות ביעד עבור נציג זה' : 'אין היסטוריית קבוצות עבור נציג זה'}
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
                    {filteredGroups.map((group) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        // Calculate days difference for Live items or just generally
                        let isUrgent = false;
                        if (group.parsedDepartureDate) {
                            const timeDiff = group.parsedDepartureDate.getTime() - today.getTime();
                            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                            // Mark as urgent if leaving today/tomorrow and not sent
                            isUrgent = daysDiff <= 1 && daysDiff >= -1 && !group.departure_sent;
                        }

                        return (
                        <TableRow key={group.id} className={isUrgent ? "bg-red-50 hover:bg-red-100" : ""}>
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
  );
}