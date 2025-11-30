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
    IonTitle,
    IonToolbar,
    useIonAlert,
    useIonToast
} from '@ionic/react';
import { add, create, trash } from 'ionicons/icons';
import React, { useCallback, useEffect, useState } from 'react';
import AddBillForm from '../components/AddBillForm';
import { useAuth } from '../context/AuthContext';
import { Bill, Category, User } from '../models/types';
import { billService } from '../services/billService';
import { categoryService } from '../services/categoryService';
import { userService } from '../services/userService';

const ManageBills: React.FC = () => {
    const { user } = useAuth();
    const [bills, setBills] = useState<Bill[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [userProfile, setUserProfile] = useState<User | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [presentAlert] = useIonAlert();
    const [presentToast] = useIonToast();

    const fetchData = useCallback(async () => {
        if (user) {
            try {
                const [billsData, categoriesData, userData] = await Promise.all([
                    billService.getBills(user.id),
                    categoryService.getCategories(user.id),
                    userService.getUser(user.id)
                ]);
                setBills(billsData);
                setCategories(categoriesData);
                setUserProfile(userData);
            } catch (error) {
                console.error('Error fetching data:', error);
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

    const getCategoryName = (categoryId: string) => {
        const category = categories.find(c => c.id === categoryId);
        return category ? `${category.icon} ${category.name}` : 'Unknown';
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

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Manage Bills</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen>
                <div className="p-4">
                    <IonCard>
                        <IonCardHeader>
                            <IonCardTitle>All Bills ({bills.length})</IonCardTitle>
                        </IonCardHeader>
                        <IonCardContent>
                            <IonList>
                                {bills.length === 0 ? (
                                    <div className="text-center p-4 text-gray-500">
                                        No bills found. Add your first bill below.
                                    </div>
                                ) : (
                                    bills.map((bill) => (
                                        <IonItem key={bill.id} className="mb-2">
                                            <IonLabel>
                                                <h2 className="font-semibold">{bill.name}</h2>
                                                <p className="text-sm text-gray-600">
                                                    {getCategoryName(bill.category_id)} •
                                                    Due: {new Date(bill.due_date).toLocaleDateString()} •
                                                    {formatRecurrence(bill.recurrence)} •
                                                    ${bill.amount.toFixed(2)}
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
                                    ))
                                )}
                            </IonList>
                        </IonCardContent>
                    </IonCard>
                </div>

                <IonFab vertical="bottom" horizontal="end" slot="fixed">
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