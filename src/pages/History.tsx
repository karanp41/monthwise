import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bill } from '../models/types';
import { billService } from '../services/billService';
import './History.css';

const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        try {
          const data = await billService.getBills(user.id);
          // Filter for paid bills or past due
          const history = data.filter(bill => bill.is_paid);
          setBills(history);
        } catch (error) {
          console.error('Error fetching history:', error);
        }
      }
    };
    fetchHistory();
  }, [user]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>History</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList inset={true}>
          {bills.length === 0 ? (
            <div className="text-center p-4 text-gray-500">
              No payment history yet.
            </div>
          ) : (
            bills.map((bill) => (
              <IonItem key={bill.id}>
                <IonIcon slot="start" icon={checkmarkCircle} color="success" />
                <IonLabel>
                  <h2>{bill.name}</h2>
                  <p>Paid on {new Date(bill.paid_date!).toLocaleDateString()}</p>
                </IonLabel>
                <IonNote slot="end" color="dark">
                  ${bill.amount}
                </IonNote>
              </IonItem>
            ))
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default HistoryPage;
