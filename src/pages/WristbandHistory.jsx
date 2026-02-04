import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, Search, Filter } from "lucide-react";
import { format } from "date-fns";

export default function WristbandHistory() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const { data: logs = [], isLoading } = useQuery({
        queryKey: ['wristbandLogs'],
        queryFn: () => base44.entities.WristbandScanLog.list(),
        refetchInterval: 5000 // Live updates
    });

    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            (log.nfc_id && log.nfc_id.includes(search)) ||
            (log.customer_name && log.customer_name.includes(search)) ||
            (log.order_number && log.order_number.includes(search)) ||
            (log.event_name && log.event_name.includes(search));
            
        const matchesStatus = statusFilter === "all" || log.status === statusFilter;

        return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.scan_time) - new Date(a.scan_time));

    const getStatusBadge = (status) => {
        switch(status) {
            case 'success': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">אושר</Badge>;
            case 'warning': return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">סורב (אירוע)</Badge>;
            case 'error': return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200">לא זוהה</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="p-8 md:p-12 text-right min-h-screen bg-slate-50" dir="rtl">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-3 mb-6">
                    <History className="w-8 h-8 text-slate-600" />
                    <h1 className="text-3xl font-bold text-slate-800">היסטוריית סריקות צמידים</h1>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Filter className="w-5 h-5" />
                            סינון וחיפוש
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                                <Input 
                                    placeholder="חיפוש לפי מספר צמיד, שם לקוח, הזמנה או אירוע..." 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pr-10"
                                />
                            </div>
                            <div className="w-full md:w-48">
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="סטטוס" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">כל הסטטוסים</SelectItem>
                                        <SelectItem value="success">אושר</SelectItem>
                                        <SelectItem value="warning">סורב</SelectItem>
                                        <SelectItem value="error">לא זוהה</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                לא נמצאו רשומות בהיסטוריה
                            </div>
                        ) : (
                            <div className="rounded-md border-t">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="text-right">זמן סריקה</TableHead>
                                            <TableHead className="text-right">סטטוס</TableHead>
                                            <TableHead className="text-right">אירוע</TableHead>
                                            <TableHead className="text-right">שם לקוח</TableHead>
                                            <TableHead className="text-right">מספר הזמנה</TableHead>
                                            <TableHead className="text-right">מזהה צמיד</TableHead>
                                            <TableHead className="text-right">נסרק ע"י</TableHead>
                                            <TableHead className="text-right">הודעה מערכת</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLogs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="font-medium">
                                                    {format(new Date(log.scan_time), 'dd/MM/yyyy HH:mm:ss')}
                                                </TableCell>
                                                <TableCell>{getStatusBadge(log.status)}</TableCell>
                                                <TableCell>{log.event_name}</TableCell>
                                                <TableCell>{log.customer_name || '-'}</TableCell>
                                                <TableCell>{log.order_number || '-'}</TableCell>
                                                <TableCell className="font-mono text-xs">{log.nfc_id}</TableCell>
                                                <TableCell>{log.scanned_by}</TableCell>
                                                <TableCell className="text-slate-500 text-sm">{log.message}</TableCell>
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