import {
  IonAlert,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonLoading,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { logOutOutline } from 'ionicons/icons';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User } from '../models/types';
import { userService } from '../services/userService';
import { allCurrencies, getCurrencySymbol } from '../services/utilService';
import './Settings.css';

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [presentToast] = useIonToast();

  useEffect(() => {
    if (user) {
      const storageKey = `userProfile_${user.id}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const profile = JSON.parse(stored);
          setUserProfile(profile);
          setSelectedCurrency(profile?.default_currency || 'USD');
        } catch (e) {
          console.error('Failed to parse stored user profile', e);
        }
      } else {
        userService.getUser(user.id).then((data) => {
          setUserProfile(data);
          setSelectedCurrency(data?.default_currency || 'USD');
          localStorage.setItem(storageKey, JSON.stringify(data));
        }).catch(console.error);
      }
    }
  }, [user]);

  useEffect(() => {
    if (userProfile?.default_currency) {
      setSelectedCurrency(userProfile.default_currency);
    }
  }, [userProfile]);

  const handleCurrencyChange = async (val: string) => {
    if (!user) return;
    try {
      const updated = await userService.updateUser(user.id, { default_currency: val });
      setUserProfile(updated);
      setSelectedCurrency(val);
      localStorage.setItem(`userProfile_${user.id}`, JSON.stringify(updated));
      presentToast({ message: 'Default currency updated', duration: 2000, color: 'success' });
    } catch (err) {
      console.error(err);
      presentToast({ message: 'Failed to update currency', duration: 2000, color: 'danger' });
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed', err);
      presentToast({ message: 'Failed to sign out', duration: 2000, color: 'danger' });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonLoading isOpen={signingOut} message={'Signing out...'} />
        <IonAlert
          isOpen={showSignOutConfirm}
          header={'Confirm Sign Out'}
          message={`Are you sure you want to sign out${user?.email ? ` from ${user.email}` : ''}?`}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => setShowSignOutConfirm(false),
            },
            {
              text: 'Sign Out',
              role: 'destructive',
              handler: async () => {
                setShowSignOutConfirm(false);
                await handleSignOut();
              },
            },
          ]}
          onDidDismiss={() => setShowSignOutConfirm(false)}
        />
        <IonList inset={true} className='!rounded-2xl shadow-md'>
          <IonItem>
            <IonLabel>
              <h2>Account</h2>
              <p>{user?.email || 'Guest'}</p>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Default Currency</IonLabel>
            <IonSelect
              value={selectedCurrency}
              placeholder="Select Currency"
              onIonChange={(e) => handleCurrencyChange(e.detail.value!)}
            >

              {Object.keys(allCurrencies).map((code) => (
                <IonSelectOption key={code} value={code}>
                  {code} ({getCurrencySymbol(code)})
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <div className="p-4 border-t mt-4">
            <IonButton
              expand="block"
              color="danger"
              onClick={() => setShowSignOutConfirm(true)}
              disabled={signingOut}
            >
              <IonIcon slot="start" icon={logOutOutline} />
              Sign Out
            </IonButton>
          </div>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
