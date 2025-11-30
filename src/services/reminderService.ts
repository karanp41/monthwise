import { LocalNotifications } from '@capacitor/local-notifications';
import { Bill } from '../models/types';
import { supabase } from './supabase';

export const reminderService = {
    async createReminder(reminder: { bill_id: string; notify_before_days: number }) {
        const { data, error } = await supabase
            .from('reminders')
            .insert([reminder])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async requestPermissions() {
        const { display } = await LocalNotifications.requestPermissions();
        return display === 'granted';
    },

    async scheduleBillReminders(bill: Bill & { notify_before_days?: number }) {
        const dueDate = new Date(bill.due_date);
        const notifications = [];

        const notifyBefore = bill.notify_before_days || 0;
        if (notifyBefore > 0) {
            const currentDueDate = new Date(dueDate);
            const now = new Date();
            // For recurring bills, schedule for the next 12 occurrences
            const maxSchedules = bill.recurrence !== 'none' ? 12 : 1;
            for (let i = 0; i < maxSchedules; i++) {
                const beforeDate = new Date(currentDueDate);
                beforeDate.setDate(currentDueDate.getDate() - notifyBefore);
                if (beforeDate > now) {
                    notifications.push({
                        title: `Upcoming Bill: ${bill.name}`,
                        body: `Your ${bill.name} bill of $${bill.amount} is due in ${notifyBefore} day${notifyBefore > 1 ? 's' : ''}.`,
                        id: parseInt(bill.id.replace(/\D/g, '').slice(0, 8)) + i * 2 + 1,
                        schedule: { at: beforeDate },
                        extra: { billId: bill.id },
                    });
                }
                // Move to next recurrence
                if (bill.recurrence === 'monthly') {
                    currentDueDate.setMonth(currentDueDate.getMonth() + 1);
                } else if (bill.recurrence === 'quarterly') {
                    currentDueDate.setMonth(currentDueDate.getMonth() + 3);
                } else if (bill.recurrence === 'yearly') {
                    currentDueDate.setFullYear(currentDueDate.getFullYear() + 1);
                } else {
                    break; // For 'none', only once
                }
            }
        }

        // Reminder on due date
        const currentDueDate = new Date(dueDate);
        const now = new Date();
        const maxSchedules = bill.recurrence !== 'none' ? 12 : 1;
        for (let i = 0; i < maxSchedules; i++) {
            if (currentDueDate > now) {
                notifications.push({
                    title: `Bill Due Today: ${bill.name}`,
                    body: `Your ${bill.name} bill of $${bill.amount} is due today!`,
                    id: parseInt(bill.id.replace(/\D/g, '').slice(0, 8)) + i * 2 + 2,
                    schedule: { at: currentDueDate },
                    extra: { billId: bill.id },
                });
            }
            // Move to next recurrence
            if (bill.recurrence === 'monthly') {
                currentDueDate.setMonth(currentDueDate.getMonth() + 1);
            } else if (bill.recurrence === 'quarterly') {
                currentDueDate.setMonth(currentDueDate.getMonth() + 3);
            } else if (bill.recurrence === 'yearly') {
                currentDueDate.setFullYear(currentDueDate.getFullYear() + 1);
            } else {
                break;
            }
        }

        if (notifications.length > 0) {
            await LocalNotifications.schedule({ notifications });
        }
    },

    async cancelBillReminders(billId: string) {
        // In a real app, we'd track notification IDs. 
        // For MVP, we might need a better strategy or store IDs in the bill/reminder table.
        // This is a placeholder.
        const pending = await LocalNotifications.getPending();
        const toCancel = pending.notifications
            .filter(n => n.extra && n.extra.billId === billId)
            .map(n => ({ id: n.id }));

        if (toCancel.length > 0) {
            await LocalNotifications.cancel({ notifications: toCancel });
        }
    }
};
