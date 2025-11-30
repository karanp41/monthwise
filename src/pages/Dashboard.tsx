import {
  IonBadge,
  IonButton,
  IonButtons,
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
  IonSkeletonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  RefresherEventDetail,
  useIonToast
} from '@ionic/react';
import { add, alertCircle } from 'ionicons/icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import AddBillForm from '../components/AddBillForm';
import { useAuth } from '../context/AuthContext';
import { Bill, BillWithPaymentStatus, Category, User } from '../models/types';
import { billService } from '../services/billService';
import { categoryService } from '../services/categoryService';
import './Dashboard.css';

import { reminderService } from '../services/reminderService';
import { userService } from '../services/userService';
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
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'thisMonth'>('overview');
  const [presentToast] = useIonToast();
  const [calendarDate, setCalendarDate] = useState<Date | null>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  const fetchBills = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const [billsData, categoriesData] = await Promise.all([
          billService.getBillsWithPaymentStatus(user.id),
          categoryService.getCategories(user.id)
        ]);
        setBills(billsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching bills:', error);
      } finally {
        setLoading(false);
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

  useEffect(() => {
    if (user) {
      const storageKey = `userProfile_${user.id}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          setUserProfile(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse stored user profile', e);
        }
      } else {
        userService.getUser(user.id).then((profile) => {
          setUserProfile(profile);
          localStorage.setItem(storageKey, JSON.stringify(profile));
        }).catch(console.error);
      }
    }
  }, [user]);

  // Map of date string (YYYY-MM-DD) to bills due on that date
  const billsByDate = React.useMemo(() => {
    const map: Record<string, BillWithPaymentStatus[]> = {};
    bills.forEach((bill: BillWithPaymentStatus) => {
      const _dateStr = new Date(bill.effective_due_date);
      const dateStr = _dateStr.getFullYear() + '-' + String(_dateStr.getMonth() + 1).padStart(2, '0') + '-' + String(_dateStr.getDate()).padStart(2, '0');

      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(bill);
    });

    return map;
  }, [bills]);

  const handleRefresh = (event: CustomEvent<RefresherEventDetail>) => {
    fetchBills().then(() => {
      event.detail.complete();
    });
  };

  const handleAddBill = async (data: Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'is_paid'> & { reminder: string }) => {
    if (user) {
      try {
        const { reminder, ...billData } = data;
        const notify_before_days = reminder === 'never' ? 0 : parseInt(reminder, 10);
        const newBill = await billService.addBill({
          ...billData,
          user_id: user.id,
          is_paid: false,
        });
        if (notify_before_days > 0) {
          await reminderService.createReminder({
            bill_id: newBill.id,
            notify_before_days,
          });
        }
        await reminderService.scheduleBillReminders({ ...newBill, notify_before_days });
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
      <IonToggle
        slot="start"
        enableOnOffLabels={true}
        checked={bill.is_current_month_paid}
        onIonChange={() => togglePaid(bill)}
        className='mr-4'
      />
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

  const renderSkeletonBillItem = () => (
    <IonItem lines='none'>
      <div slot="start" className="w-12 h-6 bg-gray-200 rounded-full mr-4 animate-pulse"></div>
      <IonLabel>
        <IonSkeletonText animated style={{ width: '60%', height: '20px' }} />
        <IonSkeletonText animated style={{ width: '40%', height: '14px', marginTop: '4px' }} />
      </IonLabel>
      <IonSkeletonText slot="end" animated style={{ width: '50px', height: '20px' }} />
    </IonItem>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Hi, {userProfile?.name || 'User'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Calendar Overview */}
        <div className="dashboard-calendar-container mb-6">
          <Calendar
            className="border rounded-lg shadow-md bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            value={calendarDate}
            onChange={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (value: any) => setCalendarDate((Array.isArray(value) ? value[0] : value) as Date | null)
            }
            tileContent={({ date }: { date: Date }) => {
              const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
              const bills: BillWithPaymentStatus[] = billsByDate[dateStr] || [];
              return (
                <div className="calendar-icons" style={{ minHeight: 18, paddingTop: 2 }}>
                  {bills.map((bill: BillWithPaymentStatus, idx: number) => (
                    <span key={bill.id} style={{ marginLeft: idx > 0 ? 2 : 0, paddingRight: 6, fontSize: 12, zIndex: 10 - idx, position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                      {getCategoryName(bill.category_id).split(' ')[0]}
                      <small style={{ fontSize: 8, marginLeft: 1, fontWeight: 'bold' }}>
                        {bill.is_current_month_paid ? 'P' : 'U'}
                      </small>
                    </span>
                  ))}
                </div>
              );
            }}
            tileClassName={({ date }: { date: Date }) => {
              const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
              const bills: BillWithPaymentStatus[] = billsByDate[dateStr] || [];
              if (bills.length === 0) return '';

              const now = new Date();
              let hasOverdue = false;
              let hasDueSoonUnpaid = false;
              let allPaid = true;
              let hasUnpaidAfter3Days = false;

              bills.forEach((bill) => {
                if (bill.is_overdue) hasOverdue = true;
                if (!bill.is_current_month_paid) {
                  allPaid = false;
                  // Check if due in next 3 days (including today)
                  const dueDate = new Date(bill.effective_due_date);
                  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (diffDays >= 0 && diffDays <= 2) hasDueSoonUnpaid = true;
                  if (diffDays > 2) hasUnpaidAfter3Days = true;
                }
              });

              if (hasOverdue) return 'calendar-tile-overdue';
              if (hasDueSoonUnpaid) return 'calendar-tile-due-soon';
              if (allPaid) return 'calendar-tile-all-paid';
              if (hasUnpaidAfter3Days) return 'calendar-tile-unpaid-later';
              return '';
            }}
            onClickDay={(date) => { setSelectedDate(date); setShowBillModal(true); }}
          />
        </div>

        {/* Bill Details Modal */}
        <IonModal isOpen={showBillModal} onDidDismiss={() => setShowBillModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>
                Bills for {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
              </IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowBillModal(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            {selectedDate && (
              <IonList>
                {(() => {
                  const dateStr = selectedDate.getFullYear() + '-' + String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' + String(selectedDate.getDate()).padStart(2, '0');
                  const billsForDate = billsByDate[dateStr] || [];
                  return billsForDate.length > 0 ? (
                    billsForDate.map(renderBillItem)
                  ) : (
                    <IonItem>
                      <IonLabel>No bills due on this date.</IonLabel>
                    </IonItem>
                  );
                })()}
              </IonList>
            )}
          </IonContent>
        </IonModal>

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
            {loading ? (
              <>
                {/* Loading Skeletons */}
                <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                  <IonListHeader className="font-semibold">
                    <IonSkeletonText animated style={{ width: '120px', height: '20px' }} />
                  </IonListHeader>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx}>{renderSkeletonBillItem()}</div>
                  ))}
                </IonList>
                <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                  <IonListHeader className="font-semibold">
                    <IonSkeletonText animated style={{ width: '100px', height: '20px' }} />
                  </IonListHeader>
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <div key={idx}>{renderSkeletonBillItem()}</div>
                  ))}
                </IonList>
                <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                  <IonListHeader className="font-semibold">
                    <IonSkeletonText animated style={{ width: '110px', height: '20px' }} />
                  </IonListHeader>
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx}>{renderSkeletonBillItem()}</div>
                  ))}
                </IonList>
              </>
            ) : (
              <>
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
            )}
          </>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold p-4">This Month's Bills</h2>
              <IonList inset={true} className='p-0 !m-0'>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx}>{renderSkeletonBillItem()}</div>
                  ))
                ) : getCurrentMonthBills().length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    No bills for this month.
                  </div>
                ) : (
                  getCurrentMonthBills()
                    .sort((a, b) => new Date(a.effective_due_date).getTime() - new Date(b.effective_due_date).getTime())
                    .map(bill => (
                      <IonItem key={bill.id}>
                        <IonToggle
                          slot="start"
                          checked={bill.is_current_month_paid}
                          onIonChange={() => togglePaid(bill)}
                        />
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
