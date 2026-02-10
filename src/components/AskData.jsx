import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Sparkles, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

export default function AskData({ type }) {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAsk = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;

        setIsLoading(true);
        setAnswer('');

        try {
            const response = await base44.functions.invoke('analyzeData', { 
                question, 
                type 
            });
            
            if (response.data.answer) {
                setAnswer(response.data.answer);
            } else {
                toast.error('לא התקבלה תשובה');
            }
        } catch (error) {
            console.error(error);
            toast.error('שגיאה בשליחת השאלה');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100 mb-6 overflow-hidden">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="bg-white p-2 rounded-full shadow-sm mt-1">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-indigo-900">שאל את הנתונים</h3>
                            <p className="text-sm text-indigo-700/80">שאל כל שאלה לגבי הנתונים בטבלה וקבל תשובה מיידית</p>
                        </div>
                        
                        <form onSubmit={handleAsk} className="flex gap-2">
                            <Input 
                                placeholder="לדוגמה: כמה הוצאות היו החודש על מוניות? / מה סך ההכנסות מלקוח X?"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                className="bg-white border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                            />
                            <Button 
                                type="submit" 
                                disabled={isLoading || !question.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 ml-2" /> שאל</>}
                            </Button>
                        </form>

                        {answer && (
                            <div className="bg-white/80 rounded-lg p-4 border border-indigo-100 mt-2 animate-in fade-in slide-in-from-top-2">
                                <p className="text-indigo-900 font-medium leading-relaxed">
                                    {answer}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}