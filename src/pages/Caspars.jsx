import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Trash2, Search, Plus } from "lucide-react";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Caspars() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: caspars = [], isLoading } = useQuery({
    queryKey: ['caspars'],
    queryFn: () => base44.entities.CasparFilling.list('-created_date', 500),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CasparFilling.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['caspars']);
      toast.success("הרשומה נמחקה בהצלחה");
    },
    onError: () => {
      toast.error("שגיאה במחיקת הרשומה");
    }
  });

  const filteredCaspars = caspars.filter(item => 
    item.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.phone_number?.includes(searchTerm) ||
    item.hotel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">רשימת כספרים</h1>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input 
              placeholder="חיפוש לפי שם, טלפון או מלון..." 
              className="pr-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link to={createPageUrl('CasparFilling')}>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">הוסף כספר</span>
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-right font-bold">שם מלא</TableHead>
                <TableHead className="text-right font-bold">טלפון</TableHead>
                <TableHead className="text-right font-bold">מלון</TableHead>
                <TableHead className="text-right font-bold">תאריך עזיבה</TableHead>
                <TableHead className="text-center font-bold">כמות אנשים</TableHead>
                <TableHead className="text-center font-bold">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCaspars.length > 0 ? (
                filteredCaspars.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">{item.full_name}</TableCell>
                    <TableCell dir="ltr" className="text-right">{item.phone_number}</TableCell>
                    <TableCell>{item.hotel}</TableCell>
                    <TableCell>
                      {item.departure_date ? format(new Date(item.departure_date), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full text-sm min-w-[30px]">
                        {item.people_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                            <AlertDialogDescription>
                              פעולה זו תמחק את הרשומה של {item.full_name} לצמיתות ולא ניתן לשחזר אותה.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-red-600 hover:bg-red-700">
                              מחק
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    לא נמצאו רשומות
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      
      <div className="mt-4 text-slate-500 text-sm">
        סה"כ רשומות: {filteredCaspars.length}
      </div>
    </div>
  );
}