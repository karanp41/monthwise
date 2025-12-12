/* eslint-disable  @typescript-eslint/no-explicit-any */
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

    async getRemindersForBills(billIds: string[]) {
        if (!billIds || billIds.length === 0) return {} as Record<string, number>;
        const { data, error } = await supabase
            .from('reminders')
            .select('bill_id, notify_before_days')
            .in('bill_id', billIds);
        if (error) throw error;
        const map: Record<string, number> = {};
        (data || []).forEach((r: { bill_id: string; notify_before_days: number }) => {
            map[r.bill_id] = r.notify_before_days ?? 0;
        });
        return map;
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

    // New: schedule daily notifications within reminder window until paid
    async scheduleDailyWindowReminders(bill: Bill & { notify_before_days?: number; is_paid?: boolean }) {
        const granted = await this.requestPermissions();
        if (!granted) return false;

        const notifyBefore = bill.notify_before_days || 0;
        if (notifyBefore <= 0) return false;

        const now = new Date();
        const dueDate = new Date(bill.due_date);

        // Build next occurrence due date depending on recurrence
        const occurrences: Date[] = [];
        const maxSchedules = bill.recurrence !== 'none' ? 12 : 1;
        const current = new Date(dueDate);
        for (let i = 0; i < maxSchedules; i++) {
            occurrences.push(new Date(current));
            if (bill.recurrence === 'monthly') current.setMonth(current.getMonth() + 1);
            else if (bill.recurrence === 'quarterly') current.setMonth(current.getMonth() + 3);
            else if (bill.recurrence === 'yearly') current.setFullYear(current.getFullYear() + 1);
            else break;
        }

        const notifications: Array<any> = [];
        const baseId = parseInt(String(bill.id).replace(/\D/g, '').slice(0, 8) || '0') || Math.floor(Math.random() * 1000000);

        occurrences.forEach((occDue, idx) => {
            const windowStart = new Date(occDue);
            windowStart.setDate(occDue.getDate() - notifyBefore);

            // If we are within the window (from windowStart to occDue), schedule daily notifications at 9:00 and 18:00 local time
            if (now <= occDue) {
                const dayCursor = new Date(Math.max(now.getTime(), windowStart.getTime()));
                // normalize to local midnight for iteration
                dayCursor.setHours(0, 0, 0, 0);
                const end = new Date(occDue);
                end.setHours(23, 59, 59, 999);

                while (dayCursor <= end) {
                    // 9:00
                    const morning = new Date(dayCursor);
                    morning.setHours(9, 0, 0, 0);
                    if (morning > now) {
                        notifications.push({
                            id: baseId + idx * 1000 + (dayCursor.getTime() % 1000) + 1,
                            title: `Bill due soon: ${bill.name}`,
                            body: `Due ${notifyBefore} day(s) window • ${bill.name} • $${bill.amount}`,
                            schedule: { at: morning },
                            extra: { billId: bill.id, type: 'daily-window' },
                        });
                    }
                    // 18:00
                    const evening = new Date(dayCursor);
                    evening.setHours(18, 0, 0, 0);
                    if (evening > now) {
                        notifications.push({
                            id: baseId + idx * 1000 + (dayCursor.getTime() % 1000) + 2,
                            title: `Reminder: ${bill.name} due`,
                            body: `Don’t forget to pay • ${bill.name} • $${bill.amount}`,
                            schedule: { at: evening },
                            extra: { billId: bill.id, type: 'daily-window' },
                        });
                    }
                    // next day
                    dayCursor.setDate(dayCursor.getDate() + 1);
                }
            }
        });

        if (notifications.length > 0) {
            await LocalNotifications.schedule({ notifications });
            return true;
        }
        return false;
    },

    // New: schedule for multiple pending bills (call on app open)
    async schedulePendingBillsDailyWindow(bills: Array<Bill & { notify_before_days?: number; is_paid?: boolean }>) {
        const granted = await this.requestPermissions();
        if (!granted) return false;
        let any = false;
        for (const b of bills) {
            if (b.is_paid) continue;
            const ok = await this.scheduleDailyWindowReminders(b);
            any = any || !!ok;
        }
        return any;
    },

    // New: immediate summary notification for pending bills on app open
    async schedulePendingSummaryNotification(count: number) {
        const granted = await this.requestPermissions();
        if (!granted || count <= 0) return false;
        const id = Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
            notifications: [
                {
                    id,
                    title: `You have ${count} pending bill${count > 1 ? 's' : ''}`,
                    body: 'Tap to review and mark as paid.',
                    schedule: { at: new Date(Date.now() + 1500) },
                    extra: { type: 'pending-summary' },
                },
            ],
        });
        return true;
    },

    async scheduleTestNotification(opts?: { title?: string; body?: string; delayMs?: number; extra?: Record<string, unknown> }) {
        const granted = await this.requestPermissions();
        if (!granted) return false;

        const delayMs = opts?.delayMs ?? 5000;
        const when = new Date(Date.now() + delayMs);
        const id = Math.floor(Math.random() * 1000000);

        await LocalNotifications.schedule({
            notifications: [
                {
                    id,
                    title: opts?.title ?? 'Test Notification',
                    body: opts?.body ?? 'This is a quick test notification.',
                    schedule: { at: when },
                    extra: opts?.extra ?? { type: 'test' },
                },
            ],
        });
        return true;
    },

    async scheduleImmediateBillNotification(bill: Pick<Bill, 'id' | 'name' | 'amount'>, delayMs = 5000) {
        const granted = await this.requestPermissions();
        if (!granted) return false;
        const when = new Date(Date.now() + delayMs);
        const numericId = parseInt(bill.id.replace(/\D/g, '').slice(0, 8) || '0') || Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
            notifications: [
                {
                    id: numericId,
                    title: `Bill Reminder: ${bill.name}`,
                    body: `Your ${bill.name} bill of $${bill.amount} is due soon.`,
                    schedule: { at: when },
                    extra: { billId: bill.id, type: 'test-bill' },
                },
            ],
        });
        return true;
    },

    async scheduleBatchImmediateBillNotifications(
        bills: Array<Pick<Bill, 'id' | 'name' | 'amount'>>,
        startDelayMs = 3000,
        stepDelayMs = 1500
    ) {
        const granted = await this.requestPermissions();
        if (!granted) return false;
        const notifications = bills.map((b, idx) => {
            const baseId = parseInt(b.id.replace(/\D/g, '').slice(0, 8) || '0') || Math.floor(Math.random() * 1000000);
            return {
                id: baseId + idx,
                title: `Bill Reminder: ${b.name}`,
                body: `Your ${b.name} bill of $${b.amount} is due soon (test).`,
                schedule: { at: new Date(Date.now() + startDelayMs + idx * stepDelayMs) },
                extra: { billId: b.id, type: 'test-bill-batch' },
            };
        });
        if (notifications.length > 0) {
            await LocalNotifications.schedule({ notifications });
        }
        return true;
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
