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
import { BillPayment, Category } from '../models/types';
import { billService } from '../services/billService';
import { categoryService } from '../services/categoryService';
import { getCurrencySymbol } from '../services/utilService';
import './History.css';

interface PaymentWithBill extends BillPayment {
  bills?: {
    name: string;
    category_id: string;
  };
}

const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentWithBill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        try {
          const [paymentsData, categoriesData] = await Promise.all([
            billService.getAllPaymentHistory(user.id),
            categoryService.getCategories(user.id)
          ]);
          setPayments(paymentsData);
          setCategories(categoriesData);
        } catch (error) {
          console.error('Error fetching history:', error);
        }
      }
    };
    fetchHistory();
  }, [user]);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? `${category.icon} ${category.name}` : 'Unknown';
  };

  const getBillName = (payment: PaymentWithBill) => {
    return payment.bills?.name || 'Unknown Bill';
  };

  const getCategoryId = (payment: PaymentWithBill) => {
    return payment.bills?.category_id || '';
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Payment History</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList inset={true}>
          {payments.length === 0 ? (
            <div className="text-center p-4 text-gray-500">
              No payment history yet.
            </div>
          ) : (
            payments.map((payment) => (
              <IonItem key={payment.id}>
                <IonIcon slot="start" icon={checkmarkCircle} color="success" />
                <IonLabel>
                  <h2>{getBillName(payment)}</h2>
                  <p>
                    {getCategoryName(getCategoryId(payment))} •
                    Paid on {new Date(payment.payment_date).toLocaleDateString()} •
                    {payment.payment_month}
                  </p>
                  {payment.notes && (
                    <p className="text-sm text-gray-600">{payment.notes}</p>
                  )}
                </IonLabel>
                <IonNote slot="end" color="dark">
                  {getCurrencySymbol(payment.currency)}{payment.amount.toFixed(2)}
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
