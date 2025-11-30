import { User } from '../models/types';
import { supabase } from './supabase';

// Simple in-memory map to deduplicate concurrent requests.
const pendingRequests: Map<string, Promise<unknown>> = new Map();

export const userService = {
    async createUser(userId: string, email: string, name: string) {
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    id: userId,
                    email,
                    name,
                    default_currency: 'USD',
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return data as User;
    },

    async getUser(userId: string) {
        const key = `getUser:${userId}`;
        if (pendingRequests.has(key)) return pendingRequests.get(key) as Promise<User>;

        const p = (async () => {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            return data as User;
        })();

        pendingRequests.set(key, p);
        try {
            const res = await p;
            return res;
        } finally {
            pendingRequests.delete(key);
        }
    },

    async updateUser(userId: string, updates: Partial<User>) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        return data as User;
    }
};
