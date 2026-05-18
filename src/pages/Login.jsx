import React, { useState } from 'react';
import { supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'אימייל או סיסמה שגויים' : error.message);
    } else {
      window.location.href = '/';
    }
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('נרשמת בהצלחה! ממתין לאישור מנהל');
      setMode('login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-blue-50/30 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="bg-slate-900 text-white rounded-t-xl pb-6 pt-6">
          <CardTitle className="text-2xl font-bold text-center">
            {mode === 'login' ? 'התחברות למערכת' : 'הרשמה למערכת'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 px-6 pb-8">
          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label>שם מלא</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ישראל ישראלי" required />
              </div>
            )}
            <div className="space-y-2">
              <Label>אימייל</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" dir="ltr" required />
            </div>
            <div className="space-y-2">
              <Label>סיסמה</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" dir="ltr" required minLength={6} />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? <><LogIn className="w-4 h-4 ml-2" />התחבר</> : <><UserPlus className="w-4 h-4 ml-2" />הירשם</>}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-blue-600 text-sm hover:underline">
              {mode === 'login' ? 'אין לך חשבון? הירשם כאן' : 'כבר יש לך חשבון? התחבר'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
