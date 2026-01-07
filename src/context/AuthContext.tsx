import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { userService } from '../services/userService';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signOut: () => Promise<void>;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const initializeSession = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) {
                    console.error('Failed to fetch auth session', error);
                }
                if (!isMounted) return;
                const session = data?.session ?? null;
                setSession(session);
                setUser(session?.user ?? null);
                // If there is a pending push token (saved before login), attach it now
                try {
                    const pending = localStorage.getItem('pendingPushToken');
                    const userId = session?.user?.id;
                    if (pending && userId) {
                        await userService.savePushToken(userId, pending);
                        localStorage.removeItem('pendingPushToken');
                    }
                } catch (e) {
                    console.error('Failed to attach pending push token on init', e);
                }
            } catch (error) {
                console.error('Unexpected error while initializing auth session', error);
                if (!isMounted) return;
                setSession(null);
                setUser(null);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initializeSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;
            setSession(session);
            setUser(session?.user ?? null);
            // Attach pending token if present (user just signed in)
            try {
                const pending = localStorage.getItem('pendingPushToken');
                const userId = session?.user?.id;
                if (pending && userId) {
                    await userService.savePushToken(userId, pending);
                    localStorage.removeItem('pendingPushToken');
                }
            } catch (e) {
                console.error('Failed to attach pending push token on auth state change', e);
            }
            setLoading(false);
        });

        return () => {
            isMounted = false;
            authListener?.subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string, name: string) => {
        // Create auth user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) throw error;

        if (data.user) {
            // Create entry in users table
            await userService.createUser(data.user.id, email, name);

            // Create default categories for the new user
            // await categoryService.createDefaultCategories(data.user.id);
            // If there was a pending push token saved before signup, attach it to this new user
            try {
                const pending = localStorage.getItem('pendingPushToken');
                if (pending) {
                    await userService.savePushToken(data.user.id, pending);
                    localStorage.removeItem('pendingPushToken');
                }
            } catch (e) {
                console.error('Failed to attach pending push token after signup', e);
            }
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        // Clear stored user profiles
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('userProfile_')) {
                localStorage.removeItem(key);
            }
        });
    };

    const deleteAccount = async () => {
        if (!user?.id) throw new Error('No user session found');

        // Delete user record from database
        await userService.deleteUser(user.id);

        // Delete auth account
        await supabase.auth.admin.deleteUser(user.id);

        // Clear stored user profiles
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('userProfile_')) {
                localStorage.removeItem(key);
            }
        });

        // Sign out
        await supabase.auth.signOut();
    };

    const value = {
        session,
        user,
        loading,
        signIn,
        signUp,
        signOut,
        deleteAccount,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
