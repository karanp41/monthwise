import { LocalNotifications } from '@capacitor/local-notifications';
import { Bill } from '../models/types';

export const reminderService = {
    async requestPermissions() {
        const { display } = await LocalNotifications.requestPermissions();
        return display === 'granted';
    },

    async scheduleBillReminders(bill: Bill) {
        const dueDate = new Date(bill.due_date);
        const notifications = [];

        // Reminder 3 days before
        const threeDaysBefore = new Date(dueDate);
        threeDaysBefore.setDate(dueDate.getDate() - 3);
        if (threeDaysBefore > new Date()) {
            notifications.push({
                title: `Upcoming Bill: ${bill.name}`,
                body: `Your ${bill.name} bill of $${bill.amount} is due in 3 days.`,
                id: parseInt(bill.id.replace(/\D/g, '').slice(0, 8)) + 1, // Simple hash for ID
                schedule: { at: threeDaysBefore },
                extra: { billId: bill.id },
            });
        }

        // Reminder on due date
        if (dueDate > new Date()) {
            notifications.push({
                title: `Bill Due Today: ${bill.name}`,
                body: `Your ${bill.name} bill of $${bill.amount} is due today!`,
                id: parseInt(bill.id.replace(/\D/g, '').slice(0, 8)) + 2,
                schedule: { at: dueDate },
                extra: { billId: bill.id },
            });
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
