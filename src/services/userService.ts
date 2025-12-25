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
                    onboarding_currency_set: false,
                    onboarding_first_bill_added: false,
                    onboarding_calendar_tour_done: false,
                    onboarding_checklist_tour_done: false,
                    onboarding_bills_page_tour_done: false,
                    onboarding_completed_at: null,
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
    },

    /**
     * Save a device push token for a user. This writes to `user_push_tokens` table
     * (preferred) and falls back to updating the `users` table's `push_token` field
     * if that table does not exist.
     */
    async savePushToken(userId: string, token: string, platform?: string) {
        // Try writing to a dedicated tokens table first (recommended).
        try {
            const { data, error } = await supabase
                .from('user_push_tokens')
                .upsert(
                    {
                        user_id: userId,
                        token,
                        platform: platform || null,
                        last_seen_at: new Date().toISOString(),
                        is_active: true,
                    },
                    { onConflict: 'token' }
                )
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (e: any) {
            console.error('Failed to save push token in user_push_tokens table', e);

            // Fallback: if the `user_push_tokens` table isn't available, store token on users table.
            try {
                const { data, error } = await supabase
                    .from('users')
                    .update({ push_token: token, push_token_last_seen_at: new Date().toISOString() })
                    .eq('id', userId)
                    .select()
                    .single();

                if (error) throw error;
                return data as User;
            } catch (err) {
                console.error('Failed to save push token in fallback users table', err);
                throw err;
            }
        }
    }
};
