import {
  IonBadge,
  IonCard,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  RefresherEventDetail,
  useIonToast
} from '@ionic/react';
import { add, alertCircle, checkmarkCircle, ellipseOutline } from 'ionicons/icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AddBillForm from '../components/AddBillForm';
import { useAuth } from '../context/AuthContext';
import { Bill, BillWithPaymentStatus, Category } from '../models/types';
import { billService } from '../services/billService';
import { categoryService } from '../services/categoryService';
import './Dashboard.css';

import { reminderService } from '../services/reminderService';
import { getCurrencySymbol } from '../services/utilService';

interface CategorizedBills {
  overdue: BillWithPaymentStatus[];
  dueToday: BillWithPaymentStatus[];
  dueTomorrow: BillWithPaymentStatus[];
  dueWithin7Days: BillWithPaymentStatus[];
  dueNext15Days: BillWithPaymentStatus[];
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [bills, setBills] = useState<BillWithPaymentStatus[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'thisMonth'>('overview');
  const [presentToast] = useIonToast();
  const hasFetchedRef = useRef(false);

  const fetchBills = useCallback(async () => {
    if (user) {
      try {
        const [billsData, categoriesData] = await Promise.all([
          billService.getBillsWithPaymentStatus(user.id),
          categoryService.getCategories(user.id)
        ]);
        setBills(billsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching bills:', error);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchBills();
      reminderService.requestPermissions();
    }
  }, [user, fetchBills]);

  const handleRefresh = (event: CustomEvent<RefresherEventDetail>) => {
    fetchBills().then(() => {
      event.detail.complete();
    });
  };

  const handleAddBill = async (data: Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'is_paid'>) => {
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

  const togglePaid = async (bill: BillWithPaymentStatus) => {
    if (!user) return;

    try {
      if (bill.is_current_month_paid) {
        // Find and delete the payment for the effective due date month
        const paymentMonth = new Date(bill.effective_due_date).toISOString().split('T')[0].substring(0, 7) + '-01';
        const payments = await billService.getPaymentHistory(bill.id);
        const currentPayment = payments.find(p => p.payment_month === paymentMonth);

        if (currentPayment) {
          await billService.deletePayment(currentPayment.id);
          presentToast({
            message: 'Payment unmarked',
            duration: 2000,
            color: 'warning',
          });
        }
      } else {
        // Record payment for the effective due date month
        const paymentMonth = new Date(bill.effective_due_date).toISOString().split('T')[0].substring(0, 7) + '-01';
        await billService.recordPayment(bill.id, user.id, bill.amount, paymentMonth);
        presentToast({
          message: 'Payment recorded!',
          duration: 2000,
          color: 'success',
        });
      }
      fetchBills();
    } catch (error) {
      console.error('Error updating payment:', error);
      presentToast({
        message: 'Failed to update payment',
        duration: 2000,
        color: 'danger',
      });
    }
  };

  // Categorize bills
  const categorizeBills = (): CategorizedBills => {
    const categorized: CategorizedBills = {
      overdue: [],
      dueToday: [],
      dueTomorrow: [],
      dueWithin7Days: [],
      dueNext15Days: [],
    };

    bills.forEach(bill => {
      if (bill.is_overdue) {
        categorized.overdue.push(bill);
      } else if (bill.days_until_due === 0) {
        categorized.dueToday.push(bill);
      } else if (bill.days_until_due === 1) {
        categorized.dueTomorrow.push(bill);
      } else if (bill.days_until_due > 1 && bill.days_until_due <= 7) {
        categorized.dueWithin7Days.push(bill);
      } else if (bill.days_until_due > 7 && bill.days_until_due <= 15) {
        categorized.dueNext15Days.push(bill);
      }
    });

    return categorized;
  };

  const categorizedBills = categorizeBills();
  // const totalPending = bills.filter(b => !b.is_current_month_paid).reduce((sum, bill) => sum + bill.amount, 0);
  // const totalPaid = bills.filter(b => b.is_current_month_paid).reduce((sum, bill) => sum + bill.amount, 0);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? `${category.icon} ${category.name}` : 'Unknown';
  };

  const formatDueDate = (bill: BillWithPaymentStatus) => {
    const date = new Date(bill.effective_due_date);
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();

    if (bill.is_current_month_paid) {
      if (bill.recurrence === 'monthly') {
        return `${monthName} ${day} (Next Month)`;
      } else if (bill.recurrence === 'quarterly') {
        return `${monthName} ${day} (Next Quarter)`;
      } else if (bill.recurrence === 'yearly') {
        return `${monthName} ${day} (Next Year)`;
      }
    }
    return `${monthName} ${day}`;
  };

  const getCurrentMonthBills = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    return bills.filter(bill => {
      // Show bills that are due this month OR were paid this month
      const billDate = new Date(bill.effective_due_date);
      const isDueThisMonth = billDate.getMonth() === currentMonth && billDate.getFullYear() === currentYear;
      const wasPaidThisMonth = bill.is_current_month_paid;

      return isDueThisMonth || wasPaidThisMonth;
    });
  };

  const renderBillItem = (bill: BillWithPaymentStatus) => (
    <IonItem key={bill.id} lines='none'>
      <div
        slot="start"
        className="cursor-pointer"
        onClick={() => togglePaid(bill)}
      >
        <IonIcon
          icon={bill.is_current_month_paid ? checkmarkCircle : ellipseOutline}
          color={bill.is_current_month_paid ? 'success' : 'medium'}
          size="large"
        />
      </div>
      <IonLabel className={bill.is_current_month_paid ? 'opacity-50 line-through' : ''}>
        <h2 className="flex items-center gap-2">
          {bill.name}
          {bill.is_overdue && (
            <IonBadge color="danger" className="text-xs flex items-center">
              <IonIcon icon={alertCircle} className="mr-1" size="small" />
              Overdue
            </IonBadge>
          )}
        </h2>
        <p>{getCategoryName(bill.category_id)} • {formatDueDate(bill)}</p>
      </IonLabel>
      <IonNote slot="end" color={bill.is_current_month_paid ? 'success' : bill.is_overdue ? 'danger' : 'dark'}>
        {getCurrencySymbol(bill.currency)}{bill.amount.toFixed(2)}
      </IonNote>
    </IonItem>
  );

  return (
    <IonPage>
      {/* <IonHeader>
        <IonToolbar>
          <IonTitle>MonthWise</IonTitle>
        </IonToolbar>
      </IonHeader> */}
      <IonContent fullscreen className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Tabs */}
        <IonSegment
          value={activeTab}
          onIonChange={(e) => setActiveTab(e.detail.value as 'overview' | 'thisMonth')}
          className="mb-4"
        >
          <IonSegmentButton value="overview">
            <IonLabel>Overview</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="thisMonth">
            <IonLabel>This Month</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {activeTab === 'overview' ? (
          <>
            {/* <div className="grid grid-cols-2 gap-4 mb-4">
              <IonCard className="m-0 bg-red-50 dark:bg-red-900/20">
                <IonCardHeader>
                  <IonCardSubtitle>Pending This Month</IonCardSubtitle>
                  <IonCardTitle className="text-red-600 dark:text-red-400 text-2xl">
                    {totalPending.toFixed(2)}
                  </IonCardTitle>
                </IonCardHeader>
              </IonCard>
              <IonCard className="m-0 bg-green-50 dark:bg-green-900/20">
                <IonCardHeader>
                  <IonCardSubtitle>Paid This Month</IonCardSubtitle>
                  <IonCardTitle className="text-green-600 dark:text-green-400 text-2xl">
                    {totalPaid.toFixed(2)}
                  </IonCardTitle>
                </IonCardHeader>
              </IonCard>
            </div> */}

            {/* Overdue Bills */}
            {categorizedBills.overdue.length > 0 && (
              <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                <IonListHeader color="danger" className="font-semibold">
                  ⚠️ Overdue ({categorizedBills.overdue.length})
                </IonListHeader>
                {categorizedBills.overdue.map(renderBillItem)}
              </IonList>
            )}

            {/* Due Today */}
            {categorizedBills.dueToday.length > 0 && (
              <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                <IonListHeader color="warning" className="font-semibold">
                  🔴 Due Today ({categorizedBills.dueToday.length})
                </IonListHeader>
                {categorizedBills.dueToday.map(renderBillItem)}
              </IonList>
            )}

            {/* Due Tomorrow */}
            {categorizedBills.dueTomorrow.length > 0 && (
              <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                <IonListHeader color="primary" className="font-semibold">
                  🟠 Due Tomorrow ({categorizedBills.dueTomorrow.length})
                </IonListHeader>
                {categorizedBills.dueTomorrow.map(renderBillItem)}
              </IonList>
            )}

            {/* Due Within 7 Days */}
            {categorizedBills.dueWithin7Days.length > 0 && (
              <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                <IonListHeader className="font-semibold">
                  🟡 Due Within 7 Days ({categorizedBills.dueWithin7Days.length})
                </IonListHeader>
                {categorizedBills.dueWithin7Days.map(renderBillItem)}
              </IonList>
            )}

            {/* Due Next 15 Days */}
            {categorizedBills.dueNext15Days.length > 0 && (
              <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                <IonListHeader className="font-semibold">
                  🟢 Due Next 15 Days ({categorizedBills.dueNext15Days.length})
                </IonListHeader>
                {categorizedBills.dueNext15Days.map(renderBillItem)}
              </IonList>
            )}

            {/* No bills message */}
            {bills.length === 0 && (
              <IonCard className="text-center p-8">
                <p className="text-gray-500">No bills added yet. Click + to add your first bill.</p>
              </IonCard>
            )}
          </>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold p-4">This Month's Bills</h2>
              <IonList inset={true} className='p-0 !m-0'>
                {getCurrentMonthBills().length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    No bills for this month.
                  </div>
                ) : (
                  getCurrentMonthBills()
                    .sort((a, b) => new Date(a.effective_due_date).getTime() - new Date(b.effective_due_date).getTime())
                    .map(bill => (
                      <IonItem key={bill.id}>
                        <div
                          slot="start"
                          className="cursor-pointer"
                          onClick={() => togglePaid(bill)}
                        >
                          <IonIcon
                            icon={bill.is_current_month_paid ? checkmarkCircle : ellipseOutline}
                            color={bill.is_current_month_paid ? 'success' : 'medium'}
                            size="large"
                          />
                        </div>
                        <IonLabel className={bill.is_current_month_paid ? 'line-through opacity-60' : ''}>
                          <h2>{bill.name}</h2>
                          <p>{getCategoryName(bill.category_id)} • {formatDueDate(bill)}</p>
                        </IonLabel>
                        <IonNote slot="end" className='text-md' color={bill.is_current_month_paid ? 'success' : 'dark'}>
                          {getCurrencySymbol(bill.currency)}{bill.amount.toFixed(2)}
                        </IonNote>
                      </IonItem>
                    ))
                )}
              </IonList>
            </div>
          </>
        )}

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
