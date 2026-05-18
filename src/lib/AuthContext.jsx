import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({});
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUser(session.user);
      } else {
        setIsLoadingAuth(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUser = async (authUser) => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profile?.status === 'approved') {
        setUser({
          ...authUser,
          ...profile,
          full_name: authUser.user_metadata?.full_name || authUser.email,
        });
        setIsAuthenticated(true);
        setAuthError(null);
      } else if (profile?.status === 'pending') {
        setAuthError({ type: 'user_not_registered', message: 'המשתמש ממתין לאישור' });
        setIsAuthenticated(false);
      } else {
        // Create user profile if doesn't exist
        await supabase.from('users').insert({ id: authUser.id, role: 'user', status: 'pending' });
        setAuthError({ type: 'user_not_registered', message: 'המשתמש ממתין לאישור' });
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('loadUser error:', err);
      setAuthError({ type: 'unknown', message: err.message });
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadUser(session.user);
    } else {
      setIsLoadingAuth(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authChecked,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      checkUserAuth: checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
