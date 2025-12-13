/* eslint-disable  @typescript-eslint/no-explicit-any */
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
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
  RefresherEventDetail,
  useIonAlert,
  useIonToast
} from '@ionic/react';
import { add, alertCircle, alertCircleSharp, calendarSharp, listOutline } from 'ionicons/icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import AddBillForm from '../components/AddBillForm';
import { useAuth } from '../context/AuthContext';
import { Bill, BillWithPaymentStatus, Category, User } from '../models/types';
import { billService } from '../services/billService';
import { categoryService } from '../services/categoryService';
import './Dashboard.css';

import { useHistory } from 'react-router-dom';
import { BottomSpacer } from '../components/BottomSpacer';
import GuidedOverlay from '../components/GuidedOverlay';
import { reminderService } from '../services/reminderService';
import { userService } from '../services/userService';
import { getCategoryName, getCurrencySymbol } from '../services/utilService';

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
  const [view, setView] = useState<'calendar' | 'checklist'>('calendar');
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();
  const [calendarDate, setCalendarDate] = useState<Date | null>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingBills, setTogglingBills] = useState<Set<string>>(new Set());
  const [remindersMap, setRemindersMap] = useState<Record<string, number>>({});
  const [showCalendarOverlay, setShowCalendarOverlay] = useState(false);
  const [showChecklistOverlay, setShowChecklistOverlay] = useState(false);
  const history = useHistory();
  const hasFetchedRef = useRef(false);

  const fetchBills = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const [billsData, categoriesData] = await Promise.all([
          billService.getBillsWithPaymentStatus(user.id),
          categoryService.getCategories()
        ]);
        setBills(billsData);
        setCategories(categoriesData);
        // Fetch notify_before_days for these bills
        try {
          const ids = billsData.map(b => b.id);
          const map = await reminderService.getRemindersForBills(ids);
          setRemindersMap(map);
        } catch (e) {
          console.warn('Failed to fetch reminders for bills', e);
          setRemindersMap({});
        }
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

  // When bills list changes (and on app open), schedule pending daily window reminders
  useEffect(() => {
    (async () => {
      if (!user || bills.length === 0) return;
      try {
        const pendingBillsFull = bills.filter(b => !b.current_month_paid);
        const pendingBillsForSchedule = pendingBillsFull.map(b => ({
          ...b,
          due_date: b.effective_due_date,
          is_paid: b.current_month_paid,
          notify_before_days: remindersMap[b.id] ?? 0,
        })) as any;

        // 1) Immediate summary notification
        await reminderService.schedulePendingSummaryNotification(pendingBillsFull.length);

        // 2) Immediate bill notifications for those inside their reminder window today
        const now = new Date();
        const immediateTargets = pendingBillsFull
          .filter(b => {
            const notifyBefore: number = remindersMap[b.id] ?? 0;
            if (!notifyBefore) return false;
            const due = new Date(b.effective_due_date);
            const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= notifyBefore; // inside window including today
          })
          .sort((a, b) => new Date(a.effective_due_date).getTime() - new Date(b.effective_due_date).getTime())
          .slice(0, 3); // avoid spamming, limit to first three

        // console.log('Scheduling immediate notifications for bills:', immediateTargets, pendingBillsFull);
        for (const b of immediateTargets) {
          await reminderService.scheduleImmediateBillNotification({ id: b.id, name: b.name, amount: b.amount }, 3000);
        }

        // 3) Schedule daily window notifications
        await reminderService.schedulePendingBillsDailyWindow(pendingBillsForSchedule as any);
      } catch (e) {
        console.error('Failed to schedule pending bill reminders on app open/change:', e);
      }
    })();
  }, [user, bills, remindersMap]);

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

  // Determine if we should show guided overlays
  useEffect(() => {
    if (!user || !userProfile) return;
    const url = new URL(window.location.href);
    const fromParam = url.searchParams.get('tour');

    if (!userProfile.onboarding_calendar_tour_done && (fromParam === 'calendar' || userProfile.onboarding_first_bill_added)) {
      setView('calendar');
      setShowCalendarOverlay(true);
    }
  }, [user, userProfile]);

  const handleCalendarOverlayNext = async () => {
    if (!user) return;
    try {
      await userService.updateUser(user.id, { onboarding_calendar_tour_done: true });
      // Update local cached profile
      const updated = await userService.getUser(user.id);

      // Update local storage cache
      localStorage.setItem(`userProfile_${user.id}`, JSON.stringify(updated));

      setUserProfile(updated);
    } catch {
      console.error('Failed to update onboarding_calendar_tour_done');
    }
    setShowCalendarOverlay(false);
    setView('checklist');
    setShowChecklistOverlay(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('tour');
    history.replace(url.pathname + url.search);
  };

  const handleChecklistOverlayNext = async () => {
    if (!user) return;
    try {
      await userService.updateUser(user.id, { onboarding_checklist_tour_done: true });
      const updated = await userService.getUser(user.id);
      // Update local storage cache
      localStorage.setItem(`userProfile_${user.id}`, JSON.stringify(updated));
      setUserProfile(updated);
    } catch {
      console.error('Failed to update onboarding_checklist_tour_done');
    }
    setShowChecklistOverlay(false);
    history.replace('/manage-bills?tour=bills');
  };

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

  const togglePaid = async (bill: BillWithPaymentStatus, monthToToggle?: 'current' | 'effective') => {
    if (!user) return;

    // const currentDate = new Date();
    const paymentMonth = monthToToggle === 'current'
      ? new Date().toISOString().split('T')[0].substring(0, 8) + '01'
      : new Date(bill.effective_due_date).toISOString().split('T')[0].substring(0, 7) + '-01';

    try {
      const payments = await billService.getPaymentHistory(bill.id);
      const existingPayment = payments
        .sort((a, b) => new Date(b.payment_month).getTime() - new Date(a.payment_month).getTime())
        .find(p => p.payment_month === paymentMonth);

      // If unmarking a paid bill, ask for confirmation first
      if (existingPayment) {
        const monthLabel = (() => {
          if (monthToToggle === 'current') {
            const now = new Date();
            return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          } else {
            const eff = new Date(bill.effective_due_date);
            return eff.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          }
        })();

        const role: string = await new Promise((resolve) => {
          presentAlert({
            header: 'Mark as Unpaid?',
            message: `Do you want to mark "${bill.name}" as unpaid for ${monthLabel}?`,
            buttons: [
              { text: 'Cancel', role: 'cancel' },
              { text: 'Yes, Unmark', role: 'confirm' }
            ],
            onDidDismiss: (e: any) => resolve(e.detail.role)
          });
        });

        if (role !== 'confirm') {
          // User cancelled; keep toggle state unchanged
          return;
        }
      }

      // Show spinner only for actual mutations
      setTogglingBills(prev => new Set(prev).add(bill.id));

      if (existingPayment) {
        // Delete the payment
        await billService.deletePayment(existingPayment.id);
        presentToast({
          message: 'Payment marked as unpaid',
          duration: 2000,
          color: 'warning',
        });

        // Update the next_due_date to previous month's due date in bills table
        const effectiveDate = new Date(bill.effective_due_date);
        const previousMonthDate = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth() - 1, effectiveDate.getDate());
        await billService.updateBill(bill.id, { next_due_date: previousMonthDate.toISOString() });
      } else {
        // Record payment
        await billService.recordPayment(bill.id, user.id, bill.amount, paymentMonth);
        presentToast({
          message: 'Payment recorded!',
          duration: 2000,
          color: 'success',
          icon: 'checkmark-circle',
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
    } finally {
      setTogglingBills(prev => {
        const newSet = new Set(prev);
        newSet.delete(bill.id);
        return newSet;
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
      const wasPaidThisMonth = bill.current_month_paid;

      return isDueThisMonth || wasPaidThisMonth;
    });
  };

  const renderBillItem = (bill: BillWithPaymentStatus) => (
    <IonItem key={bill.id} lines='none'>
      {togglingBills.has(bill.id) ? (
        <div slot="start" className="flex items-center justify-center w-12 h-6 mr-4">
          <IonSpinner name="crescent" />
        </div>
      ) : (
        <IonToggle
          slot="start"
          enableOnOffLabels={true}
          checked={bill.is_current_month_paid}
          onIonChange={() => togglePaid(bill, 'effective')}
          className='mr-4'
        />
      )}
      <IonLabel className={bill.is_current_month_paid ? 'opacity-50 line-through' : ''}>
        <h2 className="flex items-center gap-2">
          {bill.name}
          {bill.is_overdue && (
            <IonBadge className="text-xs flex items-center bg-red-500">
              <IonIcon icon={alertCircle} className="mr-1" size="small" />
              Overdue
            </IonBadge>
          )}
        </h2>
        <p>{getCategoryName(bill.category_id, categories)} • {formatDueDate(bill)}</p>
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
          {import.meta.env.DEV && (
            <IonButtons slot="end">
              <IonButton
                size="small"
                onClick={async () => {
                  try {
                    const ok = await reminderService.scheduleTestNotification({
                      title: 'MonthWise Test',
                      body: 'This should fire in ~5 seconds.',
                      delayMs: 5000,
                    });
                    presentToast({
                      message: ok ? 'Scheduled test notification.' : 'Notification permissions not granted.',
                      duration: 2000,
                      color: ok ? 'success' : 'warning',
                    });
                  } catch (e) {
                    console.error(e);
                    presentToast({ message: 'Failed to schedule test notification.', duration: 2000, color: 'danger' });
                  }
                }}
              >
                Test Notify
              </IonButton>
              <IonButton
                size="small"
                onClick={async () => {
                  try {
                    const upcoming = [...bills]
                      .filter(b => !b.is_current_month_paid)
                      .sort((a, b) => new Date(a.effective_due_date).getTime() - new Date(b.effective_due_date).getTime())
                      .slice(0, 5)
                      .map(b => ({ id: b.id, name: b.name, amount: b.amount }));
                    const ok = await reminderService.scheduleBatchImmediateBillNotifications(upcoming, 3000, 1500);
                    presentToast({
                      message: ok ? `Scheduled ${upcoming.length} test bill notification(s).` : 'Notification permissions not granted.',
                      duration: 2000,
                      color: ok ? 'success' : 'warning',
                    });
                  } catch (e) {
                    console.error(e);
                    presentToast({ message: 'Failed to schedule batch notifications.', duration: 2000, color: 'danger' });
                  }
                }}
              >
                Trigger Bills
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* View Toggle */}
        <IonSegment
          value={view}
          onIonChange={(e) => setView(e.detail.value as 'calendar' | 'checklist')}
          className="mb-4"
        >
          <IonSegmentButton value="calendar">
            <IonIcon icon={calendarSharp} className='h-6 w-6' />
          </IonSegmentButton>
          <IonSegmentButton value="checklist">
            <IonIcon icon={listOutline} className='h-6 w-6' />
          </IonSegmentButton>
        </IonSegment>

        {view === 'calendar' ? (
          <>
            {/* Calendar Overview */}
            {/* <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <IonIcon icon={bulbSharp} />
              Smart Bill Calendar</h2> */}
            <div className="dashboard-calendar-container mb-6">
              <Calendar
                className="border rounded-2xl shadow-md bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
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
                          {getCategoryName(bill.category_id, categories).split(' ')[0]}
                          {/* <small style={{ fontSize: 8, marginLeft: 1, fontWeight: 'bold' }}>
                            {bill.is_current_month_paid ? 'P' : 'U'}
                          </small> */}
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
                    <IonButton onClick={() => setShowBillModal(false)} color={'danger'}>Close</IonButton>
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
                    <IonListHeader className="font-semibold bg-red-500">
                      <div className='flex justify-between w-full pr-4'>

                        <span className='flex gap-2'><IonIcon icon={alertCircleSharp} className='h-5 w-5 text-yellow-400' /> Overdue</span>
                        <span>{categorizedBills.overdue.length} {categorizedBills.overdue.length > 1 ? 'Bills' : 'Bill'}</span>
                      </div>
                    </IonListHeader>
                    {categorizedBills.overdue.map(renderBillItem)}
                  </IonList>
                )}

                {/* Due Today */}
                {categorizedBills.dueToday.length > 0 && (
                  <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                    <IonListHeader color="warning" className="font-semibold">
                      <div className='flex justify-between w-full pr-4'>
                        <span>🔴 Due Today</span>
                        <span>{categorizedBills.dueToday.length} {categorizedBills.dueToday.length > 1 ? 'Bills' : 'Bill'}</span>
                      </div>
                    </IonListHeader>
                    {categorizedBills.dueToday.map(renderBillItem)}
                  </IonList>
                )}

                {/* Due Tomorrow */}
                {categorizedBills.dueTomorrow.length > 0 && (
                  <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                    <IonListHeader color="primary" className="font-semibold">
                      <div className='flex justify-between w-full pr-4'>
                        <span>🟠 Due Tomorrow</span>
                        <span>{categorizedBills.dueTomorrow.length} {categorizedBills.dueTomorrow.length > 1 ? 'Bills' : 'Bill'}</span>
                      </div>
                    </IonListHeader>
                    {categorizedBills.dueTomorrow.map(renderBillItem)}
                  </IonList>
                )}

                {/* Due Within 7 Days */}
                {categorizedBills.dueWithin7Days.length > 0 && (
                  <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                    <IonListHeader className="font-semibold">
                      <div className='flex justify-between w-full pr-4'>
                        <span>🟡 Due Within 7 Days</span>
                        <span>{categorizedBills.dueWithin7Days.length} {categorizedBills.dueWithin7Days.length > 1 ? 'Bills' : 'Bill'}</span>
                      </div>
                    </IonListHeader>
                    {categorizedBills.dueWithin7Days.map(renderBillItem)}
                  </IonList>
                )}

                {/* Due Next 15 Days */}
                {categorizedBills.dueNext15Days.length > 0 && (
                  <IonList inset={true} className="shadow-md !rounded-2xl !m-0 !mb-4 pt-0">
                    <IonListHeader className="font-semibold">
                      <div className='flex justify-between w-full pr-4'>
                        <span>🟢 Due Next 15 Days</span>
                        <span>{categorizedBills.dueNext15Days.length} {categorizedBills.dueNext15Days.length > 1 ? 'Bills' : 'Bill'}</span>
                      </div>
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
              {/* <h2 className="text-lg font-semibold p-4">My Current Month's Bills</h2> */}
              <IonList inset={true} className='p-0 !m-0 shadow-md !rounded-2xl'>
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
                        {togglingBills.has(bill.id) ? (
                          <div slot="start" className="flex items-center justify-center w-12 h-6 mr-4">
                            <IonSpinner name="crescent" />
                          </div>
                        ) : (
                          <IonToggle
                            slot="start"
                            enableOnOffLabels={true}
                            checked={bill.current_month_paid}
                            onIonChange={() => togglePaid(bill, 'current')}
                            className='mr-4'
                          />
                        )}
                        <IonLabel >
                          <h2 className={bill.current_month_paid ? 'line-through opacity-60' : ''}>{bill.name}</h2>
                          <p className={bill.current_month_paid ? 'line-through opacity-60' : ''}>{getCategoryName(bill.category_id, categories)} • {formatDueDate(bill)}</p>

                          {bill.current_month_paid ? <p>Next Due on <span className='font-bold'>{formatDueDate(bill)}</span></p> : null}
                        </IonLabel>
                        <IonNote slot="end" className='text-md' color={bill.current_month_paid ? 'success' : 'dark'}>
                          {getCurrencySymbol(bill.currency)}{bill.amount.toFixed(2)}
                        </IonNote>
                      </IonItem>
                    ))
                )}
              </IonList>
            </div>
          </>
        )}

        <BottomSpacer />

        <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ bottom: '100px' }}>
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
      {showCalendarOverlay && (
        <GuidedOverlay
          targetSelector={'.dashboard-calendar-container'}
          title="Calendar Overview"
          description="This calendar highlights due dates. Tap a day to view bills due on that date. Colors indicate urgency."
          primaryText="Next"
          onPrimary={handleCalendarOverlayNext}
        />
      )}
      {showChecklistOverlay && (
        <GuidedOverlay
          targetSelector={'ion-segment'}
          title="Monthly Checklist"
          description="In the list view, quickly mark bills paid or unpaid for this month with a single toggle."
          primaryText="Got it"
          onPrimary={handleChecklistOverlayNext}
        />
      )}
    </IonPage>
  );
};

export default Dashboard;
