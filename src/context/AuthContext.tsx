import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { categoryService } from '../services/categoryService';
import { supabase } from '../services/supabase';
import { userService } from '../services/userService';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signOut: () => Promise<void>;
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

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!isMounted) return;
            setSession(session);
            setUser(session?.user ?? null);
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
            await categoryService.createDefaultCategories(data.user.id);
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

    const value = {
        session,
        user,
        loading,
        signIn,
        signUp,
        signOut,
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
