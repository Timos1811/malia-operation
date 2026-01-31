import React, { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users } from "lucide-react";

export default function Live() {
  const { data: tableData = [], isLoading } = useQuery({
    queryKey: ['tableData'],
    queryFn: () => base44.entities.TableData.list('-created_date', 100), // Get recent 100 or all if needed
  });

  const liveGroups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tableData.filter(row => {
      if (!row.departure_date || !row.order_number) return false;
      
      let departureDate = null;
      const dateStr = row.departure_date.trim();

      // Try parsing DD/MM or DD/MM/YYYY
      const parts = dateStr.split('/');
      if (parts.length >= 2) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        let year = today.getFullYear();
        
        if (parts.length === 3) {
           year = parseInt(parts[2], 10);
           if (year < 100) year += 2000; // Handle 2-digit year
        }

        departureDate = new Date(year, month, day);
        
        // If date is invalid, skip
        if (isNaN(departureDate.getTime())) return false;

        // If strict DD/MM format without year, and we need to handle year crossing (e.g. Dec to Jan)
        // For now assuming current year is fine for simple "Live" view of current operations
      }

      if (!departureDate) return false;

      // Show if today is before or same as departure date (Group is still here)
      return today <= departureDate;
    });
  }, [tableData]);

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
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {liveGroups.map((group) => (
                        <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.order_number}</TableCell>
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