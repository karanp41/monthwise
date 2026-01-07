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
import { logOutOutline, trashOutline } from 'ionicons/icons';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User } from '../models/types';
import { userService } from '../services/userService';
import { allCurrencies, getCurrencySymbol } from '../services/utilService';
import './Settings.css';

const Settings: React.FC = () => {
  const { user, signOut, deleteAccount } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      presentToast({ message: 'Account deleted successfully', duration: 2000, color: 'success' });
    } catch (err) {
      console.error('Delete account failed', err);
      presentToast({ message: 'Failed to delete account', duration: 2000, color: 'danger' });
      setDeletingAccount(false);
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
        <IonLoading isOpen={deletingAccount} message={'Deleting account...'} />
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
        <IonAlert
          isOpen={showDeleteConfirm}
          header={'Delete Account'}
          message="This action cannot be undone. All your data including bills, categories, and account information will be permanently deleted."
          inputs={[
            {
              name: 'confirmation',
              type: 'text',
              placeholder: 'Type DELETE to confirm',
            },
          ]}
          buttons={[
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => setShowDeleteConfirm(false),
            },
            {
              text: 'Delete',
              role: 'destructive',
              handler: async (alertData) => {
                const confirmation = alertData?.confirmation || '';
                if (confirmation.toUpperCase() !== 'DELETE') {
                  presentToast({ message: 'Please type DELETE to confirm', duration: 2000, color: 'warning' });
                  return;
                }
                setShowDeleteConfirm(false);
                await handleDeleteAccount();
              },
            },
          ]}
          onDidDismiss={() => setShowDeleteConfirm(false)}
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
        </IonList>
        <IonList inset={true} className='!rounded-2xl shadow-md mt-4'>
          <div className="p-4 ">
            <IonButton
              expand="block"
              color="danger"
              fill="outline"
              onClick={() => setShowSignOutConfirm(true)}
              disabled={signingOut || deletingAccount}
            >
              <IonIcon slot="start" icon={logOutOutline} />
              Sign Out
            </IonButton>
          </div>
          <div className="p-4 border-t border-gray-200">
            <IonButton
              expand="block"
              color="danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deletingAccount || signingOut}
              className="mt-2"
            >
              <IonIcon slot="start" icon={trashOutline} />
              Delete Account
            </IonButton>
          </div>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
