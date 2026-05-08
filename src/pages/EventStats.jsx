import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, BarChart3, Calendar, Users, ScanLine, Clock } from "lucide-react";

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
                        <p className="text-slate-500">צפה בנתוני מכירות וסריקות לכל אירוע לפי תאריכים (שבועות)</p>
                    </div>
                </div>

                <Card className="border-none shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="bg-white border-b">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <CardTitle className="text-lg">סינון לפי סוג אירוע</CardTitle>
                            <div className="w-full md:w-64">
                                <Select value={selectedBaseEvent} onValueChange={setSelectedBaseEvent}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="כל האירועים" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">כל האירועים</SelectItem>
                                        {attractions.map(a => (
                                            <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                                <span>טוען נתונים...</span>
                            </div>
                        ) : filteredStats.length === 0 ? (
                            <div className="text-center p-12 text-slate-500">
                                לא נמצאו נתונים להצגה
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="text-right font-bold">אירוע</TableHead>
                                        <TableHead className="text-right font-bold">תאריך</TableHead>
                                        <TableHead className="text-center font-bold">קנו כרטיס</TableHead>
                                        <TableHead className="text-center font-bold">נסרקו (הגיעו)</TableHead>
                                        <TableHead className="text-center font-bold">לא הגיעו</TableHead>
                                        <TableHead className="text-right font-bold">סריקה אחרונה</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStats.map((stat, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="font-bold text-slate-800">{stat.baseName}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md w-fit font-medium text-sm">
                                                    <Calendar className="w-4 h-4" />
                                                    {stat.dateStr}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                                                    <Users className="w-4 h-4 text-slate-400" />
                                                    {stat.buyers}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1.5 font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mx-auto w-fit">
                                                    <ScanLine className="w-4 h-4" />
                                                    {stat.scanned}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-semibold ${stat.buyers - stat.scanned > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                    {Math.max(0, stat.buyers - stat.scanned)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">
                                                {stat.lastScan ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {stat.lastScan.toLocaleString('he-IL', {
                                                            day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'
                                                        })}
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}