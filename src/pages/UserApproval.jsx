import React from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";

export default function UserApproval() {
    const queryClient = useQueryClient();
    
    const { data: users = [], isLoading } = useQuery({
        queryKey: ['usersList'],
        queryFn: () => base44.entities.User.list(),
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }) => base44.entities.User.update(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['usersList'] });
            toast.success("סטטוס המשתמש עודכן בהצלחה");
        },
        onError: () => toast.error("שגיאה בעדכון הסטטוס")
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['usersList'] });
            toast.success("הרשאת המשתמש עודכנה בהצלחה");
        },
        onError: () => toast.error("שגיאה בעדכון ההרשאה")
    });

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

    const pendingUsers = users.filter(u => u.status === 'pending');
    const approvedUsers = users.filter(u => u.status !== 'pending');

    return (
        <div className="p-4 md:p-8 space-y-8" dir="rtl">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <UserCheck className="w-8 h-8 text-indigo-600" />
                    <h1 className="text-3xl font-bold text-slate-800">ניהול הרשאות ומשתמשים</h1>
                </div>

                <div className="space-y-6">
                    <Card className="border-orange-200 shadow-md">
                        <CardHeader className="bg-orange-50/50 pb-4">
                            <CardTitle className="text-orange-800 flex items-center gap-2">
                                ממתינים לאישור <Badge className="bg-orange-500">{pendingUsers.length}</Badge>
                            </CardTitle>
                            <CardDescription>משתמשים שנרשמו למערכת וטרם קיבלו גישה</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {pendingUsers.length === 0 ? (
                                <div className="p-6 text-center text-slate-500">אין משתמשים ממתינים לאישור.</div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {pendingUsers.map(u => (
                                        <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div>
                                                <p className="font-bold text-slate-800">{u.full_name}</p>
                                                <p className="text-sm text-slate-500">{u.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'approved' })}
                                                    className="bg-green-600 hover:bg-green-700 gap-1"
                                                >
                                                    <CheckCircle className="w-4 h-4" /> אשר גישה
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-slate-800">משתמשים מאושרים ({approvedUsers.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {approvedUsers.map(u => (
                                    <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-800">{u.full_name}</p>
                                                <Badge variant="outline" className={u.role === 'admin' ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-blue-200 bg-blue-50 text-blue-700'}>
                                                    {u.role === 'admin' ? 'מנהל אופרציה' : 'נציג שטח'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-500">{u.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline"
                                                size="sm" 
                                                onClick={() => updateRoleMutation.mutate({ id: u.id, role: u.role === 'admin' ? 'user' : 'admin' })}
                                            >
                                                הפוך ל{u.role === 'admin' ? 'נציג' : 'מנהל'}
                                            </Button>
                                            <Button 
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700" 
                                                onClick={() => updateStatusMutation.mutate({ id: u.id, status: 'pending' })}
                                            >
                                                השהה גישה
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}