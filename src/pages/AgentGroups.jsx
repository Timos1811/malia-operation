import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, ArrowRight, Filter, Plane, History, X } from "lucide-react";
import { toast } from "sonner";

export default function AgentGroups() {
  const { user } = useAuth();
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [filters, setFilters] = useState({
    event_name: 'all',
    event_status: 'bought'
  });

  const { data: attractions = [] } = useQuery({
    queryKey: ['attractions'],
    queryFn: () => base44.entities.Attraction.list(),
  });

  const { data: myGroups = [], isLoading } = useQuery({
    queryKey: ['myGroups', user?.full_name, filters],
    queryFn: async () => {
      if (!user?.full_name) return [];
      
      const payload = {
          sales_rep: user.full_name,
          event_name: filters.event_name,
          event_status: filters.event_status
      };
      
      const response = await base44.functions.invoke('searchGroups', payload);
      return response.data;
    },
    enabled: !!user?.full_name,
  });

  const clearFilters = () => {
    setFilters({ event_name: 'all', event_status: 'bought' });
  };

  const filteredGroups = useMemo(() => {
    if (!showLiveOnly) return myGroups;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return myGroups.filter(group => {
      if (!group.departure_date) return false;
      
      let departureDate = null;
      const dateStr = group.departure_date.trim();

      // Handle YYYY-MM-DD (from input type="date")
      if (dateStr.includes('-')) {
        departureDate = new Date(dateStr);
      } 
      // Handle DD/MM/YYYY or DD/MM (legacy/manual)
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

      if (!departureDate || isNaN(departureDate.getTime())) return false;

      // "Live" means they are currently there, so departure date is today or in future
      return departureDate >= today;
    });
  }, [myGroups, showLiveOnly]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
                <ArrowRight className="w-5 h-5 text-slate-500" />
             </Button>
             <div>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Users className="text-indigo-600" /> 
                  הקבוצות שלי
                </h1>
                <p className="text-slate-500 text-sm">ניהול ומעקב אחר כל הקבוצות שלך</p>
             </div>
          </div>
          
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
             <Button 
                variant={!showLiveOnly ? "white" : "ghost"}
                className={`rounded-lg ${!showLiveOnly ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
                onClick={() => setShowLiveOnly(false)}
             >
                <History className="w-4 h-4 ml-2" />
                הכל
             </Button>
             <Button 
                variant={showLiveOnly ? "white" : "ghost"}
                className={`rounded-lg ${showLiveOnly ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
                onClick={() => setShowLiveOnly(true)}
             >
                <Plane className="w-4 h-4 ml-2" />
                לייב (ביעד)
             </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    סינון לפי אירועים
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">בחר אירוע / מסיבה</label>
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

        {/* Content */}
        <Card className="border-none shadow-sm">
           <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                 <span>{showLiveOnly ? 'קבוצות ביעד כעת' : 'היסטוריית קבוצות'}</span>
                 <Badge variant="secondary" className="font-mono">{filteredGroups.length}</Badge>
              </CardTitle>
           </CardHeader>
           <CardContent>
              {filteredGroups.length === 0 ? (
                 <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                    <Filter className="w-8 h-8 opacity-20" />
                    <p>לא נמצאו קבוצות לתצוגה זו</p>
                 </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                 <Table>
                    <TableHeader className="bg-slate-50">
                       <TableRow>
                          <TableHead className="text-right font-bold">מספר הזמנה</TableHead>
                          <TableHead className="text-right font-bold">תאריך עזיבה</TableHead>
                          <TableHead className="text-right font-bold">לקוחות</TableHead>
                          <TableHead className="text-right font-bold hidden md:table-cell">מלון</TableHead>
                          <TableHead className="text-right font-bold hidden md:table-cell">חברה</TableHead>
                          <TableHead className="text-right font-bold">סטטוס יורו</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {filteredGroups.map((group) => (
                          <TableRow key={group.id} className="hover:bg-slate-50/50 transition-colors">
                             <TableCell className="font-medium">
                                <Link 
                                   to={`${createPageUrl('OrderDetails')}?orderNumber=${group.order_number}`}
                                   className="text-indigo-600 hover:underline font-mono font-bold"
                                >
                                   {group.order_number}
                                </Link>
                             </TableCell>
                             <TableCell>
                                <Badge variant="outline" className="bg-white">
                                   {group.departure_date}
                                </Badge>
                             </TableCell>
                             <TableCell>
                                <div className="flex items-center gap-2">
                                   <Users className="w-3 h-3 text-slate-400" />
                                   {group.customer}
                                </div>
                             </TableCell>
                             <TableCell className="hidden md:table-cell text-slate-600">{group.hotel}</TableCell>
                             <TableCell className="hidden md:table-cell text-slate-600">{group.company}</TableCell>
                             <TableCell>
                                <Badge 
                                   className={`${
                                      group.eur_status === 'מאוזן' || group.eur_status === '0' 
                                      ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                                      : 'bg-red-100 text-red-700 hover:bg-red-100'
                                   } border-none`}
                                >
                                   {group.eur_status || '---'}
                                </Badge>
                             </TableCell>
                          </TableRow>
                       ))}
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