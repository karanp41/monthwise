import {
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonPage,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    useIonToast,
} from '@ionic/react';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { allCurrencies, getCurrencySymbol } from '../../services/utilService';

const SelectCurrency: React.FC = () => {
    const { user } = useAuth();
    const history = useHistory();
    const [currency, setCurrency] = useState('USD');
    const [saving, setSaving] = useState(false);
    const [presentToast] = useIonToast();

    useEffect(() => {
        (async () => {
            if (!user) return;
            try {
                const profile = await userService.getUser(user.id);
                setCurrency(profile.default_currency || 'USD');
            } catch (e) {
                // ignore; default USD
            }
        })();
    }, [user]);

    const onSave = async () => {
        if (!user) {
            presentToast({ message: 'Please sign in to continue', duration: 2000, color: 'warning' });
            history.replace('/login');
            return;
        }
        setSaving(true);
        try {
            await userService.updateUser(user.id, {
                default_currency: currency,
                onboarding_currency_set: true,
            });
            presentToast({ message: 'Default currency set', duration: 1500, color: 'success' });
            history.replace('/onboarding/add-bill');
        } catch (e: any) {
            presentToast({ message: e.message || 'Failed to save', duration: 2500, color: 'danger' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Set Default Currency</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <p className="text-sm opacity-80 mb-3">Choose the currency you primarily pay bills in. You can change this later in Settings.</p>
                <IonList inset={true} className="rounded-2xl shadow-sm">
                    <IonItem>
                        <IonLabel position="stacked">Default Currency</IonLabel>
                        <IonSelect value={currency} interface="popover" onIonChange={(e) => setCurrency(e.detail.value)}>
                            {Object.keys(allCurrencies).map((code) => (
                                <IonSelectOption key={code} value={code}>
                                    {code} ({getCurrencySymbol(code)})
                                </IonSelectOption>
                            ))}
                        </IonSelect>
                    </IonItem>
                </IonList>

                <div className="mt-6 flex justify-end gap-2">
                    <IonButton fill="clear" color="medium" onClick={() => history.replace('/onboarding/add-bill')}>Skip</IonButton>
                    <IonButton onClick={onSave} disabled={saving || !user}>{saving ? 'Saving...' : 'Save & Continue'}</IonButton>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default SelectCurrency;
