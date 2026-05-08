import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, BarChart3, Calendar, Users, ScanLine, Clock, ArrowRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EventStats() {
    const [selectedBaseEvent, setSelectedBaseEvent] = useState("all");

    // Fetch base attractions
    const { data: attractions = [], isLoading: isLoadingAttractions } = useQuery({
        queryKey: ['attractions'],
        queryFn: () => base44.entities.Attraction.list(),
    });

    // Fetch all active wristbands
    const { data: wristbands = [], isLoading: isLoadingWristbands } = useQuery({
        queryKey: ['wristbands_stats'],
        queryFn: () => base44.entities.Wristband.list('-created_date', 10000), // Get a lot of records
    });

    // Fetch scan logs
    const { data: scanLogs = [], isLoading: isLoadingLogs } = useQuery({
        queryKey: ['scanLogs_stats'],
        queryFn: () => base44.entities.WristbandScanLog.filter({ status: 'success' }, '-scan_time', 10000),
    });

    // Group by Event Instance (e.g. "Boat Party - 15/05/2026")
    const statsByInstance = useMemo(() => {
        const stats = {};

        // 1. Group Buyers
        wristbands.forEach(wb => {
            if (wb.allowed_events) {
                wb.allowed_events.forEach(evName => {
                    if (!stats[evName]) {
                        stats[evName] = { buyers: 0, scanned: 0, lastScan: null };
                    }
                    stats[evName].buyers += 1;
                });
            }
        });

        // 2. Group Scans
        scanLogs.forEach(log => {
            const evName = log.event_name;
            if (evName) {
                if (!stats[evName]) {
                    stats[evName] = { buyers: 0, scanned: 0, lastScan: null };
                }
                stats[evName].scanned += 1; // Assuming each log is a unique scan since we reset them. Wait, unique scans can be checked by set of nfc_id.
            }
        });
        
        // Count unique scans per event
        const uniqueScansPerEvent = {};
        scanLogs.forEach(log => {
            const evName = log.event_name;
            if (evName) {
                if (!uniqueScansPerEvent[evName]) uniqueScansPerEvent[evName] = new Set();
                uniqueScansPerEvent[evName].add(log.nfc_id);
                
                const scanTime = new Date(log.scan_time);
                if (!stats[evName]) stats[evName] = { buyers: 0, scanned: 0, lastScan: null };
                if (!stats[evName].lastScan || scanTime > stats[evName].lastScan) {
                    stats[evName].lastScan = scanTime;
                }
            }
        });

        Object.keys(uniqueScansPerEvent).forEach(evName => {
            if (stats[evName]) {
                stats[evName].scanned = uniqueScansPerEvent[evName].size;
            }
        });

        return stats;
    }, [wristbands, scanLogs]);

    const totalsByBaseEvent = useMemo(() => {
        const totals = {};
        Object.entries(statsByInstance).forEach(([name, data]) => {
            const baseName = name.split(' - ')[0];
            if (!totals[baseName]) {
                totals[baseName] = { buyers: 0, scanned: 0, instances: 0 };
            }
            totals[baseName].buyers += data.buyers;
            totals[baseName].scanned += data.scanned;
            totals[baseName].instances += 1;
        });
        return totals;
    }, [statsByInstance]);

    const filteredStats = useMemo(() => {
        let entries = Object.entries(statsByInstance).map(([name, data]) => {
            // "Boat Party - 15/05/2026"
            // Or just "Boat Party" if it's old data
            const parts = name.split(' - ');
            const baseName = parts[0];
            const dateStr = parts.length > 1 ? parts[1] : 'ללא תאריך';
            
            return {
                fullName: name,
                baseName,
                dateStr,
                ...data
            };
        });

        if (selectedBaseEvent !== "all") {
            entries = entries.filter(e => e.baseName === selectedBaseEvent);
        }

        // Sort by date (descending)
        entries.sort((a, b) => {
            if (a.dateStr === 'ללא תאריך') return 1;
            if (b.dateStr === 'ללא תאריך') return -1;
            const parseDate = (str) => {
                const [d, m, y] = str.split('/');
                return new Date(y, m-1, d).getTime();
            };
            return parseDate(b.dateStr) - parseDate(a.dateStr);
        });

        return entries;
    }, [statsByInstance, selectedBaseEvent]);

    const isLoading = isLoadingAttractions || isLoadingWristbands || isLoadingLogs;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8" dir="rtl">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                        <BarChart3 className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">דוחות וסטטיסטיקות אירועים</h1>
                        <p className="text-slate-500">בחר אירוע כדי לצפות בנתוני מכירות וסריקות שבועיים</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                        <span>טוען נתונים...</span>
                    </div>
                ) : selectedBaseEvent === "all" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {attractions.map(att => {
                            const stats = totalsByBaseEvent[att.name] || { buyers: 0, scanned: 0, instances: 0 };
                            return (
                                <Card 
                                    key={att.id} 
                                    className="hover:shadow-lg transition-all cursor-pointer border-slate-200 hover:border-indigo-300 group bg-white" 
                                    onClick={() => setSelectedBaseEvent(att.name)}
                                >
                                    <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
                                        <CardTitle className="text-xl flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                                            <Ticket className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                                            {att.name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="flex justify-between items-center text-sm text-slate-500 mb-5">
                                            <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                                                <Calendar className="w-4 h-4" />
                                                {stats.instances} שבועות מתועדים
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mb-5">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                                <div className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1"><Users className="w-3 h-3"/> רוכשים</div>
                                                <div className="font-black text-xl text-slate-800">{stats.buyers}</div>
                                            </div>
                                            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-center">
                                                <div className="text-xs text-emerald-600 mb-1 flex items-center justify-center gap-1"><ScanLine className="w-3 h-3"/> הגיעו</div>
                                                <div className="font-black text-xl text-emerald-700">{stats.scanned}</div>
                                            </div>
                                        </div>
                                        <Button className="w-full gap-2 bg-slate-900 text-white hover:bg-indigo-600 transition-colors">
                                            צפה בדוחות שבועיים <ArrowRight className="w-4 h-4 rotate-180" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <Button variant="ghost" onClick={() => setSelectedBaseEvent("all")} className="gap-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50">
                            <ArrowRight className="w-4 h-4" /> חזור לרשימת האירועים
                        </Button>
                        
                        <Card className="border-none shadow-sm rounded-xl overflow-hidden">
                            <CardHeader className="bg-indigo-50 border-b border-indigo-100">
                                <CardTitle className="text-xl text-indigo-900 flex items-center gap-2">
                                    <Ticket className="w-5 h-5 text-indigo-600" />
                                    {selectedBaseEvent} - דוח שבועי
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {filteredStats.length === 0 ? (
                                    <div className="text-center p-12 text-slate-500">
                                        לא נמצאו נתונים לאירוע זה
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="text-right font-bold">תאריך האירוע</TableHead>
                                                    <TableHead className="text-center font-bold">קנו כרטיס</TableHead>
                                                    <TableHead className="text-center font-bold">נסרקו (הגיעו)</TableHead>
                                                    <TableHead className="text-center font-bold">לא הגיעו</TableHead>
                                                    <TableHead className="text-right font-bold">סריקה אחרונה</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredStats.map((stat, idx) => (
                                                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50/50 border border-indigo-100 px-3 py-1.5 rounded-lg w-fit font-bold text-sm">
                                                                <Calendar className="w-4 h-4" />
                                                                {stat.dateStr}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex items-center justify-center gap-1.5 font-bold text-slate-700 text-lg">
                                                                <Users className="w-4 h-4 text-slate-400" />
                                                                {stat.buyers}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg mx-auto w-fit text-lg">
                                                                <ScanLine className="w-4 h-4" />
                                                                {stat.scanned}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <span className={`font-bold text-lg ${stat.buyers - stat.scanned > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                                                {Math.max(0, stat.buyers - stat.scanned)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-slate-500">
                                                            {stat.lastScan ? (
                                                                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md w-fit border border-slate-100">
                                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                                    {stat.lastScan.toLocaleString('he-IL', {
                                                                        day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-300">-</span>
                                                            )}
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
                )}
            </div>
        </div>
    );
}