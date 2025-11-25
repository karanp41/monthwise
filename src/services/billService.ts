import { Bill } from '../models/types';
import { supabase } from './supabase';

export const billService = {
    async getBills(userId: string) {
        const { data, error } = await supabase
            .from('bills')
            .select('*')
            .eq('user_id', userId)
            .order('due_date', { ascending: true });

        if (error) throw error;
        return data as Bill[];
    },

    async addBill(bill: Omit<Bill, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('bills')
            .insert([bill])
            .select()
            .single();

        if (error) throw error;
        return data as Bill;
    },

    async updateBill(id: string, updates: Partial<Bill>) {
        const { data, error } = await supabase
            .from('bills')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Bill;
    },

    async deleteBill(id: string) {
        const { error } = await supabase
            .from('bills')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
