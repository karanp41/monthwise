import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import AddBillForm from '../../components/AddBillForm';
import { useAuth } from '../../context/AuthContext';
import { Bill } from '../../models/types';
import { billService } from '../../services/billService';
import { reminderService } from '../../services/reminderService';
import { userService } from '../../services/userService';

const AddFirstBill: React.FC = () => {
    const { user } = useAuth();
    const history = useHistory();
    const [saving, setSaving] = useState(false);
    const [presentToast] = useIonToast();

    const handleAddBill = async (
        data: Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'is_paid'> & { reminder: string }
    ) => {
        if (!user) return;
        setSaving(true);
        try {
            const { reminder, ...billData } = data as any;
            const notify_before_days = reminder === 'never' ? 0 : parseInt(reminder, 10);
            const newBill = await billService.addBill({ ...billData, user_id: user.id, is_paid: false });
            if (notify_before_days > 0) {
                await reminderService.createReminder({ bill_id: newBill.id, notify_before_days });
                await reminderService.scheduleBillReminders({ ...newBill, notify_before_days } as any);
            }
            await userService.updateUser(user.id, { onboarding_first_bill_added: true });
            presentToast({ message: 'First bill added!', duration: 1500, color: 'success' });
            history.replace('/dashboard?tour=calendar');
        } catch (e: any) {
            presentToast({ message: e.message || 'Failed to add bill', duration: 2500, color: 'danger' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Add Your First Bill</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent>
                <AddBillForm onSubmit={handleAddBill as any} onCancel={() => history.replace('/dashboard')} />
            </IonContent>
        </IonPage>
    );
};

export default AddFirstBill;
