import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Sparkles, Send, User, Bot } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function AskData({ type }) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isLoading]);

    const handleAsk = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { role: 'user', content: input };
        const newMessages = [...messages, userMsg];
        
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const response = await base44.functions.invoke('analyzeData', { 
                messages: newMessages,
                type 
            });
            
            if (response.data.answer) {
                setMessages([...newMessages, { role: 'assistant', content: response.data.answer }]);
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
                    <div className="bg-white p-2 rounded-full shadow-sm mt-1 shrink-0">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 space-y-3 w-full">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-indigo-900">שאל את הנתונים {type ? `(${type})` : ''}</h3>
                            <p className="text-sm text-indigo-700/80">שאל כל שאלה לגבי הנתונים וקבל תשובה מיידית</p>
                        </div>

                        {/* Chat Area */}
                        <div className="bg-white/50 rounded-xl border border-indigo-100 min-h-[150px] max-h-[400px] overflow-hidden flex flex-col">
                            <ScrollArea className="flex-1 p-4">
                                <div className="space-y-4">
                                    {messages.length === 0 && (
                                        <div className="text-center text-slate-400 text-sm py-8">
                                            אין עדיין הודעות. נסה לשאול "כמה הכנסות היו החודש?"
                                        </div>
                                    )}
                                    
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={cn(
                                            "flex gap-3 max-w-[85%]",
                                            msg.role === 'user' ? "mr-auto flex-row-reverse" : "ml-auto"
                                        )}>
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                                msg.role === 'user' ? "bg-indigo-600 text-white" : "bg-white border border-indigo-100 text-indigo-600"
                                            )}>
                                                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                            </div>
                                            <div className={cn(
                                                "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                                                msg.role === 'user' 
                                                    ? "bg-indigo-600 text-white rounded-tr-none" 
                                                    : "bg-white border border-indigo-100 text-slate-800 rounded-tl-none"
                                            )}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {isLoading && (
                                        <div className="flex gap-3 ml-auto w-full">
                                            <div className="w-8 h-8 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            </div>
                                            <div className="bg-white/50 border border-indigo-100 p-3 rounded-2xl rounded-tl-none text-slate-500 text-sm flex items-center gap-2">
                                                <span className="animate-pulse">חושב...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={scrollRef} />
                                </div>
                            </ScrollArea>
                        </div>
                        
                        {/* Input Area */}
                        <form onSubmit={handleAsk} className="flex gap-2">
                            <Input 
                                placeholder="שאל שאלה..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="bg-white border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                            />
                            <Button 
                                type="submit" 
                                disabled={isLoading || !input.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[60px]"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}