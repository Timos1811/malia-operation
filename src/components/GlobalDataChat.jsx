import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Bot, X, Send, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from 'react-markdown';

export default function GlobalDataChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'היי! אני העוזר החכם שלך. אפשר לשאול אותי כל דבר על הנתונים במערכת - הכנסות, הוצאות, ביצועי נציגים ועוד.' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const userMsg = { role: 'user', content: inputValue };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await base44.functions.invoke('analyzeGlobalData', { 
                messages: [...messages, userMsg]
            });
            
            const answer = response.data.answer || 'לא הצלחתי למצוא תשובה, נסה שוב מאוחר יותר.';
            setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'אופס, נתקלתי בשגיאה בעיבוד הבקשה.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 left-6 z-50 font-sans" dir="rtl">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="mb-4 w-[350px] md:w-[400px]"
                    >
                        <Card className="shadow-2xl border-indigo-100 overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex flex-row items-center justify-between text-white">
                                <div className="flex items-center gap-2">
                                    <div className="bg-white/20 p-1.5 rounded-full">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                    <CardTitle className="text-base font-medium">עוזר נתונים חכם</CardTitle>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setIsOpen(false)}
                                    className="text-white hover:bg-white/20 h-8 w-8"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0 bg-slate-50 h-[400px] flex flex-col">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                                    {messages.map((msg, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                                        >
                                            <div 
                                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                                    msg.role === 'user' 
                                                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                                                        : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                                                }`}
                                            >
                                                {msg.role === 'assistant' ? (
                                                     <ReactMarkdown className="prose prose-sm prose-p:my-1 prose-a:text-blue-600">
                                                        {msg.content}
                                                     </ReactMarkdown>
                                                ) : msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-end">
                                            <div className="bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                                                <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                                <span className="text-xs text-slate-400">מעבד נתונים...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="p-3 bg-white border-t border-slate-100">
                                <form onSubmit={handleSend} className="flex w-full gap-2">
                                    <Input
                                        placeholder="שאל שאלה על הנתונים..."
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="focus-visible:ring-indigo-500"
                                    />
                                    <Button 
                                        type="submit" 
                                        size="icon" 
                                        disabled={isLoading || !inputValue.trim()}
                                        className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                                    >
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </form>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-colors ${
                    isOpen ? 'bg-slate-800 text-white' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                }`}
            >
                {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
            </motion.button>
        </div>
    );
}