import { User } from '../models/types';
import { supabase } from './supabase';

export const userService = {
    async createUser(userId: string, email: string, name: string) {
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    id: userId,
                    email,
                    name,
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return data as User;
    },

    async getUser(userId: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data as User;
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
