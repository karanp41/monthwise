import {
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherEventDetail,
  useIonToast
} from '@ionic/react';
import { add, checkmarkCircle, ellipseOutline } from 'ionicons/icons';
import React, { useEffect, useState } from 'react';
import AddBillForm from '../components/AddBillForm';
import { useAuth } from '../context/AuthContext';
import { Bill, Category } from '../models/types';
import { billService } from '../services/billService';
import { categoryService } from '../services/categoryService';
import './Dashboard.css';

import { reminderService } from '../services/reminderService';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [presentToast] = useIonToast();

  const fetchBills = async () => {
    if (user) {
      try {
        const [billsData, categoriesData] = await Promise.all([
          billService.getBills(user.id),
          categoryService.getCategories(user.id)
        ]);
        setBills(billsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching bills:', error);
      }
    }
  };

  useEffect(() => {
    fetchBills();
    reminderService.requestPermissions();
  }, [user]);

  const handleRefresh = (event: CustomEvent<RefresherEventDetail>) => {
    fetchBills().then(() => {
      event.detail.complete();
    });
  };

  const handleAddBill = async (data: any) => {
    if (user) {
      try {
        const newBill = await billService.addBill({
          ...data,
          user_id: user.id,
          is_paid: false,
        });
        await reminderService.scheduleBillReminders(newBill);
        setShowAddModal(false);
        fetchBills();
        presentToast({
          message: 'Bill added successfully!',
          duration: 2000,
          color: 'success',
        });
      } catch (error) {
        console.error('Error adding bill:', error);
        presentToast({
          message: 'Failed to add bill.',
          duration: 2000,
          color: 'danger',
        });
      }
    }
  };

  const togglePaid = async (bill: Bill) => {
    try {
      await billService.updateBill(bill.id, {
        is_paid: !bill.is_paid,
        paid_date: !bill.is_paid ? new Date().toISOString() : undefined,
      });
      fetchBills();
    } catch (error) {
      console.error('Error updating bill:', error);
    }
  };

  const totalDue = bills.reduce((sum, bill) => !bill.is_paid ? sum + bill.amount : sum, 0);
  const totalPaid = bills.reduce((sum, bill) => bill.is_paid ? sum + bill.amount : sum, 0);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? `${category.icon} ${category.name}` : 'Unknown';
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>MonthWise</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <IonCard className="m-0 bg-red-50 dark:bg-red-900/20">
              <IonCardHeader>
                <IonCardSubtitle>Pending</IonCardSubtitle>
                <IonCardTitle className="text-red-600 dark:text-red-400">
                  ${totalDue.toFixed(2)}
                </IonCardTitle>
              </IonCardHeader>
            </IonCard>
            <IonCard className="m-0 bg-green-50 dark:bg-green-900/20">
              <IonCardHeader>
                <IonCardSubtitle>Paid</IonCardSubtitle>
                <IonCardTitle className="text-green-600 dark:text-green-400">
                  ${totalPaid.toFixed(2)}
                </IonCardTitle>
              </IonCardHeader>
            </IonCard>
          </div>

          <IonList inset={true}>
            {bills.map((bill) => (
              <IonItem key={bill.id}>
                <div
                  slot="start"
                  className="cursor-pointer"
                  onClick={() => togglePaid(bill)}
                >
                  <IonIcon
                    icon={bill.is_paid ? checkmarkCircle : ellipseOutline}
                    color={bill.is_paid ? 'success' : 'medium'}
                    size="large"
                  />
                </div>
                <IonLabel className={bill.is_paid ? 'opacity-50 line-through' : ''}>
                  <h2>{bill.name}</h2>
                  <p>{getCategoryName(bill.category_id)} • Due {new Date(bill.due_date).toLocaleDateString()}</p>
                </IonLabel>
                <IonNote slot="end" color={bill.is_paid ? 'success' : 'dark'}>
                  ${bill.amount}
                </IonNote>
              </IonItem>
            ))}
          </IonList>
        </div>

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowAddModal(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonModal isOpen={showAddModal} onDidDismiss={() => setShowAddModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Add Bill</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <AddBillForm
              onSubmit={handleAddBill}
              onCancel={() => setShowAddModal(false)}
            />
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;
