export interface User {
    id: string;
    email: string;
    name: string;
    default_currency: string;
    created_at: string;
}

export interface Bill {
    id: string;
    user_id: string;
    name: string;
    category_id: string;
    amount: number;
    currency: string;
    due_date: string;
    recurrence: 'monthly' | 'quarterly' | 'yearly' | 'none';
    notes?: string;
    is_paid: boolean;
    paid_date?: string;
    next_due_date?: string; // For recurring bills
    created_at: string;
    updated_at: string;
}

export interface BillPayment {
    id: string;
    bill_id: string;
    user_id: string;
    payment_date: string;
    amount: number;
    currency: string;
    payment_month: string; // Store as YYYY-MM-01 format
    notes?: string;
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

// Enhanced bill with payment status for current month
export interface BillWithPaymentStatus extends Bill {
    is_current_month_paid: boolean;
    effective_due_date: string; // The actual due date to display (current or next month)
    is_overdue: boolean;
    days_until_due: number;
}
