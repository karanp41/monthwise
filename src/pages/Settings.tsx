import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { logOutOutline } from 'ionicons/icons';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import './Settings.css';

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList inset={true}>
          <IonItem>
            <IonLabel>
              <h2>Account</h2>
              <p>{user?.email || 'Guest'}</p>
            </IonLabel>
          </IonItem>

          <div className="p-4">
            <IonButton expand="block" color="danger" onClick={signOut}>
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
