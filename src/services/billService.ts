import { Bill, BillPayment, BillWithPaymentStatus } from '../models/types';
import { supabase } from './supabase';

// Simple in-memory map to deduplicate concurrent requests.
const pendingRequests: Map<string, Promise<unknown>> = new Map();

export const billService = {
    async getBills(userId: string) {
        const key = `getBills:${userId}`;
        if (pendingRequests.has(key)) return pendingRequests.get(key) as Promise<Bill[]>;

        const p = (async () => {
            const { data, error } = await supabase
                .from('bills')
                .select('*')
                .eq('user_id', userId)
                .order('due_date', { ascending: true });

            if (error) throw error;
            return data as Bill[];
        })();

        pendingRequests.set(key, p);
        try {
            const res = await p;
            return res;
        } finally {
            pendingRequests.delete(key);
        }
    },

    async getBill(billId: string): Promise<Bill> {
        const { data, error } = await supabase
            .from('bills')
            .select('*')
            .eq('id', billId)
            .single();

        if (error) throw error;
        return data as Bill;
    },

    async getBillsWithPaymentStatus(userId: string): Promise<BillWithPaymentStatus[]> {
        const bills = await this.getBills(userId);
        const currentDate = new Date();

        // Get all payments for this user
        const { data: payments, error: paymentsError } = await supabase
            .from('bill_payments')
            .select('*')
            .eq('user_id', userId);

        if (paymentsError) throw paymentsError;

        const billPayments = payments as BillPayment[];

        return bills.map(bill => {
            const billDate = new Date(bill.due_date);
            const dayOfMonth = billDate.getDate();

            // Calculate effective due date first
            let effectiveDueDate: Date;

            if (bill.recurrence === 'monthly') {
                // Check if this bill has any payment history
                const hasPaymentHistory = billPayments.some(p => p.bill_id === bill.id);

                if (!hasPaymentHistory) {
                    // No payment history - check if original due date is in future
                    if (billDate > currentDate) {
                        // Use the original due date directly
                        effectiveDueDate = new Date(billDate);
                    } else {
                        // Original due date is past - this bill is overdue
                        // But we still need to show it, so use the original due date
                        effectiveDueDate = new Date(billDate);
                    }
                } else {
                    // Has payment history - show next unpaid occurrence
                    const currentMonthPaid = billPayments.some(
                        p => {
                            const pd = new Date(p.payment_month);
                            return p.bill_id === bill.id && pd.getFullYear() === currentDate.getFullYear() && pd.getMonth() === currentDate.getMonth();
                        }
                    );

                    if (currentMonthPaid) {
                        // Current month paid, show next month
                        effectiveDueDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, dayOfMonth);
                    } else {
                        // Current month not paid, show current month
                        effectiveDueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayOfMonth);
                    }
                }
            } else if (bill.recurrence === 'quarterly') {
                // Similar to monthly but every 3 months
                const hasPaymentHistory = billPayments.some(p => p.bill_id === bill.id);

                if (!hasPaymentHistory) {
                    // No payment history - check if original due date is in future
                    if (billDate > currentDate) {
                        effectiveDueDate = new Date(billDate);
                    } else {
                        effectiveDueDate = new Date(billDate);
                    }
                } else {
                    // Calculate current quarter
                    const currentQuarter = Math.floor(currentDate.getMonth() / 3);

                    // Check if current quarter is paid
                    const currentQuarterPaid = billPayments.some(
                        p => {
                            const pd = new Date(p.payment_month);
                            const paymentQuarter = Math.floor(pd.getMonth() / 3);
                            return p.bill_id === bill.id && pd.getFullYear() === currentDate.getFullYear() && paymentQuarter === currentQuarter;
                        }
                    );

                    if (currentQuarterPaid) {
                        // Current quarter paid, show next quarter
                        const nextQuarter = (currentQuarter + 1) % 4;
                        const nextQuarterMonth = nextQuarter * 3;
                        effectiveDueDate = new Date(currentDate.getFullYear() + (nextQuarter === 0 ? 1 : 0), nextQuarterMonth, dayOfMonth);
                    } else {
                        // Current quarter not paid, show current quarter's due date
                        effectiveDueDate = new Date(currentDate.getFullYear(), currentQuarter * 3, dayOfMonth);
                    }
                }
            } else if (bill.recurrence === 'yearly') {
                // For yearly, check if this year is paid
                const currentYear = currentDate.getFullYear();
                const isThisYearPaid = billPayments.some(
                    p => {
                        const pd = new Date(p.payment_month);
                        return p.bill_id === bill.id && pd.getFullYear() === currentYear;
                    }
                );

                if (isThisYearPaid) {
                    // Next year
                    effectiveDueDate = new Date(currentYear + 1, billDate.getMonth(), dayOfMonth);
                } else {
                    // This year
                    effectiveDueDate = new Date(currentYear, billDate.getMonth(), dayOfMonth);
                }
            } else {
                // One-time bill
                effectiveDueDate = billDate;
            }

            // Now check if the effective due date's month/year is paid
            let isCurrentMonthPaid: boolean;
            if (bill.recurrence === 'monthly' || bill.recurrence === 'quarterly') {
                isCurrentMonthPaid = billPayments.some(
                    p => {
                        const pd = new Date(p.payment_month);
                        return p.bill_id === bill.id && pd.getFullYear() === effectiveDueDate.getFullYear() && pd.getMonth() === effectiveDueDate.getMonth();
                    }
                );
            } else if (bill.recurrence === 'yearly') {
                isCurrentMonthPaid = billPayments.some(
                    p => {
                        const pd = new Date(p.payment_month);
                        return p.bill_id === bill.id && pd.getFullYear() === effectiveDueDate.getFullYear();
                    }
                );
            } else {
                // For one-time bills, check if paid_date is set
                isCurrentMonthPaid = bill.paid_date !== null;
            }

            // Calculate days until due
            const timeDiff = effectiveDueDate.getTime() - currentDate.getTime();
            const daysUntilDue = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            // Check if overdue (only for unpaid bills)
            const isOverdue = !isCurrentMonthPaid && daysUntilDue < 0;

            return {
                ...bill,
                is_current_month_paid: isCurrentMonthPaid,
                effective_due_date: effectiveDueDate.toISOString(),
                is_overdue: isOverdue,
                days_until_due: daysUntilDue,
            };
        });
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
    },

    // Payment history functions
    async recordPayment(
        billId: string,
        userId: string,
        amount: number,
        paymentMonth?: string,
        notes?: string
    ): Promise<BillPayment> {
        // Get the bill to get its currency
        const bill = await this.getBill(billId);

        const currentDate = new Date();
        const monthToRecord = paymentMonth || new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
            .toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('bill_payments')
            .insert([{
                bill_id: billId,
                user_id: userId,
                amount,
                currency: bill.currency,
                payment_month: monthToRecord,
                notes,
            }])
            .select()
            .single();

        if (error) throw error;
        return data as BillPayment;
    },

    async getPaymentHistory(billId: string): Promise<BillPayment[]> {
        const { data, error } = await supabase
            .from('bill_payments')
            .select('*')
            .eq('bill_id', billId)
            .order('payment_month', { ascending: false });

        if (error) throw error;
        return data as BillPayment[];
    },

    async getAllPaymentHistory(userId: string): Promise<BillPayment[]> {
        const { data, error } = await supabase
            .from('bill_payments')
            .select(`
                *,
                bills (
                    name,
                    category_id
                )
            `)
            .eq('user_id', userId)
            .order('payment_date', { ascending: false });

        if (error) throw error;
        return data as BillPayment[];
    },

    async deletePayment(paymentId: string) {
        const { error } = await supabase
            .from('bill_payments')
            .delete()
            .eq('id', paymentId);

        if (error) throw error;
    },

    async isMonthPaid(billId: string, month: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('bill_payments')
            .select('id')
            .eq('bill_id', billId)
            .eq('payment_month', month)
            .limit(1);

        if (error) throw error;
        return data && data.length > 0;
    }
};

