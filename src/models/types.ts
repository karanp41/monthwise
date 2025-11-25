export interface User {
    id: string;
    email: string;
    name: string;
    created_at: string;
}

export interface Bill {
    id: string;
    user_id: string;
    name: string;
    category_id: string;
    amount: number;
    due_date: string;
    recurrence: 'monthly' | 'yearly' | 'none';
    notes?: string;
    is_paid: boolean;
    paid_date?: string;
    created_at: string;
    updated_at: string;
}

export interface Category {
    id: string;
    user_id: string;
    name: string;
    icon: string;
    color: string;
    is_default: boolean;
}

export interface Reminder {
    id: string;
    bill_id: string;
    notify_before_days: number;
    last_notified_at?: string;
}
