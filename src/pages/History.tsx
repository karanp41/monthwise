import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import React, { useEffect, useState } from 'react';
import { BottomSpacer } from '../components/BottomSpacer';
import { useAuth } from '../context/AuthContext';
import { BillPayment, Category } from '../models/types';
import { billService } from '../services/billService';
import { categoryService } from '../services/categoryService';
import { getCategoryName, getCurrencySymbol } from '../services/utilService';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        setLoading(true);
        try {
          const [paymentsData, categoriesData] = await Promise.all([
            billService.getAllPaymentHistory(user.id),
            categoryService.getCategories()
          ]);
          setPayments(paymentsData);
          setCategories(categoriesData);
        } catch (error) {
          console.error('Error fetching history:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchHistory();
  }, [user]);



  const getBillName = (payment: PaymentWithBill) => {
    return payment.bills?.name || 'Unknown Bill';
  };

  const getCategoryId = (payment: PaymentWithBill) => {
    return payment.bills?.category_id || '';
  };

  const renderSkeletonPaymentItem = () => (
    <IonItem>
      <div slot="start" className="w-6 h-6 bg-gray-200 rounded-full mr-4 animate-pulse"></div>
      <IonLabel>
        <IonSkeletonText animated style={{ width: '60%', height: '20px' }} />
        <IonSkeletonText animated style={{ width: '80%', height: '14px', marginTop: '4px' }} />
        <IonSkeletonText animated style={{ width: '40%', height: '12px', marginTop: '2px' }} />
      </IonLabel>
      <IonSkeletonText slot="end" animated style={{ width: '50px', height: '20px' }} />
    </IonItem>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Payment History</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList inset={true} className='!rounded-2xl shadow-md m-4'>
          {loading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx}>{renderSkeletonPaymentItem()}</div>
            ))
          ) : payments.length === 0 ? (
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
                    {getCategoryName(getCategoryId(payment), categories)} •
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

        <BottomSpacer />
      </IonContent>
    </IonPage>
  );
};

export default HistoryPage;
