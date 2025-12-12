import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
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
    IonPage,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    useIonAlert,
    useIonToast
} from '@ionic/react';
import { add, create, trash } from 'ionicons/icons';
import React, { useCallback, useEffect, useState } from 'react';
import AddBillForm from '../components/AddBillForm';
import { BottomSpacer } from '../components/BottomSpacer';
import { useAuth } from '../context/AuthContext';
import { Bill, Category, User } from '../models/types';
import { billService } from '../services/billService';
import { categoryService } from '../services/categoryService';
import { userService } from '../services/userService';
import { getCategoryName, getCurrencySymbol } from '../services/utilService';

const ManageBills: React.FC = () => {
    const { user } = useAuth();
    const [bills, setBills] = useState<Bill[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [userProfile, setUserProfile] = useState<User | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [loading, setLoading] = useState(true);
    const [presentAlert] = useIonAlert();
    const [presentToast] = useIonToast();

    const fetchData = useCallback(async () => {
        if (user) {
            setLoading(true);
            try {
                const storageKey = `userProfile_${user.id}`;
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    try {
                        setUserProfile(JSON.parse(stored));
                    } catch (e) {
                        console.error('Failed to parse stored user profile', e);
                    }
                } else {
                    const userData = await userService.getUser(user.id);
                    setUserProfile(userData);
                    localStorage.setItem(storageKey, JSON.stringify(userData));
                }

                const [billsData, categoriesData] = await Promise.all([
                    billService.getBills(user.id),
                    categoryService.getCategories(user.id)
                ]);

                setBills(billsData);
                setCategories(categoriesData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddBill = async (data: Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'is_paid'>) => {
        if (user) {
            try {
                await billService.addBill({
                    ...data,
                    user_id: user.id,
                    is_paid: false,
                });
                setShowAddModal(false);
                fetchData();
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

    const handleUpdateBill = async (data: Omit<Bill, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'is_paid'>) => {
        if (editingBill) {
            try {
                await billService.updateBill(editingBill.id, data);
                setEditingBill(null);
                fetchData();
                presentToast({
                    message: 'Bill updated successfully!',
                    duration: 2000,
                    color: 'success',
                });
            } catch (error) {
                console.error('Error updating bill:', error);
                presentToast({
                    message: 'Failed to update bill.',
                    duration: 2000,
                    color: 'danger',
                });
            }
        }
    };

    const handleDeleteBill = async (bill: Bill) => {
        presentAlert({
            header: 'Delete Bill',
            message: `Are you sure you want to delete "${bill.name}"? This action cannot be undone.`,
            buttons: [
                {
                    text: 'Cancel',
                    role: 'cancel',
                },
                {
                    text: 'Delete',
                    role: 'destructive',
                    handler: async () => {
                        try {
                            await billService.deleteBill(bill.id);
                            fetchData();
                            presentToast({
                                message: 'Bill deleted successfully!',
                                duration: 2000,
                                color: 'success',
                            });
                        } catch (error) {
                            console.error('Error deleting bill:', error);
                            presentToast({
                                message: 'Failed to delete bill.',
                                duration: 2000,
                                color: 'danger',
                            });
                        }
                    },
                },
            ],
        });
    };

    const formatRecurrence = (recurrence: string) => {
        switch (recurrence) {
            case 'monthly':
                return 'Monthly';
            case 'quarterly':
                return 'Quarterly';
            case 'yearly':
                return 'Yearly';
            case 'none':
                return 'One-time';
            default:
                return recurrence;
        }
    };

    const renderSkeletonBillItem = () => (
        <IonItem className="mb-2">
            <IonLabel>
                <IonSkeletonText animated style={{ width: '60%', height: '20px' }} />
                <IonSkeletonText animated style={{ width: '80%', height: '14px', marginTop: '4px' }} />
                <IonSkeletonText animated style={{ width: '50%', height: '12px', marginTop: '2px' }} />
            </IonLabel>
            <div slot="end" className="flex gap-2">
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
        </IonItem>
    );

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Manage Bills</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <IonCard className="rounded-2xl shadow-md m-4">
                    <IonCardHeader>
                        <IonCardTitle>
                            Bills by Category {loading ? '' : `(${bills.length})`}
                        </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                        {loading ? (
                            <>
                                <h3 className="text-lg font-semibold mb-2">
                                    <IonSkeletonText animated style={{ width: '150px', height: '24px' }} />
                                </h3>
                                <IonList>
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={idx}>{renderSkeletonBillItem()}</div>
                                    ))}
                                </IonList>
                                <h3 className="text-lg font-semibold mb-2 mt-4">
                                    <IonSkeletonText animated style={{ width: '120px', height: '24px' }} />
                                </h3>
                                <IonList>
                                    {Array.from({ length: 3 }).map((_, idx) => (
                                        <div key={idx}>{renderSkeletonBillItem()}</div>
                                    ))}
                                </IonList>
                            </>
                        ) : bills.length === 0 ? (
                            <div className="text-center p-4 text-gray-500">
                                No bills found. Add your first bill below.
                            </div>
                        ) : (
                            // Group bills by category id
                            (() => {
                                const grouped: Record<string, Bill[]> = bills.reduce((acc, b) => {
                                    const key = b.category_id || 'uncategorized';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(b);
                                    return acc;
                                }, {} as Record<string, Bill[]>);

                                // Render categories in the order they appear in `categories`, then any uncategorized
                                const rendered: React.ReactNode[] = [];

                                categories.forEach((cat) => {
                                    const group = grouped[cat.id];
                                    if (group && group.length > 0) {
                                        rendered.push(
                                            <div key={cat.id} className="mb-4">
                                                <h3 className="text-lg font-semibold mb-2">{cat.icon} {cat.name} ({group.length})</h3>
                                                <IonList>
                                                    {group.map((bill) => (
                                                        <IonItem key={bill.id} className="mb-2">
                                                            <IonLabel>
                                                                <h2 className="font-semibold">{bill.name}</h2>
                                                                <p className="text-sm text-gray-600">
                                                                    Due: {new Date(bill.due_date).toLocaleDateString()} • {formatRecurrence(bill.recurrence)} • {getCurrencySymbol(bill.currency)} {bill.amount.toFixed(2)}
                                                                </p>
                                                                {bill.notes && (
                                                                    <p className="text-sm text-gray-500 mt-1">{bill.notes}</p>
                                                                )}
                                                            </IonLabel>
                                                            <IonButton
                                                                fill="clear"
                                                                slot="end"
                                                                onClick={() => setEditingBill(bill)}
                                                            >
                                                                <IonIcon icon={create} color="primary" />
                                                            </IonButton>
                                                            <IonButton
                                                                fill="clear"
                                                                slot="end"
                                                                onClick={() => handleDeleteBill(bill)}
                                                            >
                                                                <IonIcon icon={trash} color="danger" />
                                                            </IonButton>
                                                        </IonItem>
                                                    ))}
                                                </IonList>
                                            </div>
                                        );
                                        // remove from grouped so we don't render again
                                        delete grouped[cat.id];
                                    }
                                });

                                // Any remaining groups are uncategorized or have unknown category ids
                                const remainingKeys = Object.keys(grouped);
                                if (remainingKeys.length > 0) {
                                    const uncategorizedBills: Bill[] = remainingKeys.reduce((acc, key) => acc.concat(grouped[key]), [] as Bill[]);
                                    rendered.push(
                                        <div key="uncat" className="mb-4">
                                            <h3 className="text-lg font-semibold mb-2">Uncategorized ({uncategorizedBills.length})</h3>
                                            <IonList>
                                                {uncategorizedBills.map((bill) => (
                                                    <IonItem key={bill.id} className="mb-2">
                                                        <IonLabel>
                                                            <h2 className="font-semibold">{bill.name}</h2>
                                                            <p className="text-sm text-gray-600">
                                                                {getCategoryName(bill.category_id, categories)} • Due: {new Date(bill.due_date).toLocaleDateString()} • {formatRecurrence(bill.recurrence)} • ${bill.amount.toFixed(2)}
                                                            </p>
                                                            {bill.notes && (
                                                                <p className="text-sm text-gray-500 mt-1">{bill.notes}</p>
                                                            )}
                                                        </IonLabel>
                                                        <IonButton
                                                            fill="clear"
                                                            slot="end"
                                                            onClick={() => setEditingBill(bill)}
                                                        >
                                                            <IonIcon icon={create} color="primary" />
                                                        </IonButton>
                                                        <IonButton
                                                            fill="clear"
                                                            slot="end"
                                                            onClick={() => handleDeleteBill(bill)}
                                                        >
                                                            <IonIcon icon={trash} color="danger" />
                                                        </IonButton>
                                                    </IonItem>
                                                ))}
                                            </IonList>
                                        </div>
                                    );
                                }

                                return <div>{rendered}</div>;
                            })()
                        )}
                    </IonCardContent>
                </IonCard>

                <BottomSpacer />
                <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ bottom: '100px' }}>
                    <IonFabButton onClick={() => setShowAddModal(true)}>
                        <IonIcon icon={add} />
                    </IonFabButton>
                </IonFab>

                {/* Add Bill Modal */}
                <IonModal isOpen={showAddModal} onDidDismiss={() => setShowAddModal(false)}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Add New Bill</IonTitle>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent>
                        <AddBillForm
                            onSubmit={handleAddBill}
                            onCancel={() => setShowAddModal(false)}
                            defaultCurrency={userProfile?.default_currency}
                        />
                    </IonContent>
                </IonModal>

                {/* Edit Bill Modal */}
                <IonModal isOpen={!!editingBill} onDidDismiss={() => setEditingBill(null)}>
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Edit Bill</IonTitle>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent>
                        {editingBill && (
                            <AddBillForm
                                initialData={editingBill}
                                onSubmit={handleUpdateBill}
                                onCancel={() => setEditingBill(null)}
                                submitButtonText="Update Bill"
                                defaultCurrency={userProfile?.default_currency}
                            />
                        )}
                    </IonContent>
                </IonModal>
            </IonContent>
        </IonPage>
    );
};

export default ManageBills;