import { Category } from '../models/types';
import { supabase } from './supabase';

export const categoryService = {
    async getCategories(userId: string) {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', userId)
            .order('name', { ascending: true });

        if (error) throw error;
        return data as Category[];
    },

    async createCategory(category: Omit<Category, 'id'>) {
        const { data, error } = await supabase
            .from('categories')
            .insert([category])
            .select()
            .single();

        if (error) throw error;
        return data as Category;
    },

    async createDefaultCategories(userId: string) {
        const defaultCategories = [
            { name: 'Rent', icon: '🏠', color: '#FF6B6B', is_default: true },
            { name: 'EMI', icon: '💳', color: '#4ECDC4', is_default: true },
            { name: 'OTT', icon: '📺', color: '#95E1D3', is_default: true },
            { name: 'Utilities', icon: '⚡', color: '#F38181', is_default: true },
            { name: 'Credit Card', icon: '💰', color: '#AA96DA', is_default: true },
            { name: 'Other', icon: '📋', color: '#FCBAD3', is_default: true },
        ];

        const categoriesToInsert = defaultCategories.map(cat => ({
            ...cat,
            user_id: userId,
        }));

        const { data, error } = await supabase
            .from('categories')
            .insert(categoriesToInsert)
            .select();

        if (error) throw error;
        return data as Category[];
    },

    async updateCategory(id: string, updates: Partial<Category>) {
        const { data, error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Category;
    },

    async deleteCategory(id: string) {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
