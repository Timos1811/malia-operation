import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from "@/components/ui/button";
import { CheckCircle2, Plus, Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function TaskSentSuccess() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
            <Card className="max-w-md w-full shadow-xl border-green-100">
                <CardContent className="pt-12 pb-8 px-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-slate-900">המשימה נשלחה בהצלחה!</h1>
                        <p className="text-slate-500">
                            דוח האירוע הועבר למנהל לאישור ותשלום.
                            <br/>
                            ספירת הסריקות לאירוע זה אופסה.
                        </p>
                    </div>

                    <div className="grid gap-3 pt-4">
                        <Link to={createPageUrl('AddTask')}>
                            <Button className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-lg gap-2">
                                <Plus className="w-5 h-5" />
                                צור משימה נוספת
                            </Button>
                        </Link>
                        
                        <Link to={createPageUrl('SellerDashboard')}>
                            <Button variant="outline" className="w-full h-12 text-lg gap-2">
                                <Home className="w-5 h-5" />
                                חזור לדף הבית
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}