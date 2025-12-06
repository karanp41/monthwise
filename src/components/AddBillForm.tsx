import {
    IonButton,
    IonDatetime,
    IonDatetimeButton,
    IonInput,
    IonItem,
    IonLabel,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonTextarea
} from '@ionic/react';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Bill, Category } from '../models/types';
import { categoryService } from '../services/categoryService';
import { userService } from '../services/userService';
import { allCurrencies, getCurrencySymbol } from '../services/utilService';

interface AddBillFormProps {
    onSubmit: (data: Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_paid'> & { reminder: string }) => void;
    onCancel: () => void;
    initialData?: Bill;
    submitButtonText?: string;
    defaultCurrency?: string;
}

const AddBillForm: React.FC<AddBillFormProps> = ({ onSubmit, onCancel, initialData, submitButtonText = 'Add Bill', defaultCurrency = 'USD' }) => {
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const { control, handleSubmit, formState: { errors }, reset } = useForm<Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_paid'> & { reminder: string }>({
        defaultValues: {
            name: initialData?.name || '',
            amount: initialData?.amount || 0,
            currency: initialData?.currency || defaultCurrency,
            due_date: initialData?.due_date || new Date().toISOString(),
            recurrence: initialData?.recurrence || 'monthly',
            category_id: initialData?.category_id || '',
            notes: initialData?.notes || '',
            reminder: 'never',
        }
    });

    useEffect(() => {
        if (user) {
            categoryService.getCategories(user.id).then(setCategories).catch(console.error);
        }
    }, [user]);

    useEffect(() => {
        if (user && !initialData) {
            userService.getUser(user.id).then(userData => {
                reset(prev => ({ ...prev, currency: userData.default_currency }));
            }).catch(console.error);
        }
    }, [user, initialData, reset]);

    useEffect(() => {
        if (initialData) {
            reset({
                name: initialData.name,
                amount: initialData.amount,
                currency: initialData.currency,
                due_date: initialData.due_date,
                recurrence: initialData.recurrence,
                category_id: initialData.category_id,
                notes: initialData.notes || '',
            });
        }
    }, [initialData, reset]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="p-4">
            <IonItem>
                <IonInput
                    label="Bill Name"
                    labelPlacement="fixed"
                    fill="solid"
                    {...control.register('name', { required: 'Name is required' })}
                />
            </IonItem>
            {errors.name && <p className="text-red-500 text-sm px-4">{errors.name.message}</p>}

            <IonItem className="mt-4">
                <IonSelect
                    label="Category"
                    // className='mt-2'
                    labelPlacement="fixed"
                    fill="solid"
                    interface="action-sheet"
                    {...control.register('category_id', { required: 'Category is required' })}
                >
                    {categories.map((cat) => (
                        <IonSelectOption key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                        </IonSelectOption>
                    ))}
                </IonSelect>
            </IonItem>
            {errors.category_id && <p className="text-red-500 text-sm px-4">{errors.category_id.message}</p>}

            <IonItem className="mt-4">
                <IonSelect
                    // className="mt-2"
                    label="Currency"
                    labelPlacement="fixed"
                    fill="solid"
                    interface="popover"
                    {...control.register('currency', { required: 'Currency is required' })}
                >
                    {Object.keys(allCurrencies).map((code) => (
                        <IonSelectOption key={code} value={code}>
                            {code} ({getCurrencySymbol(code)})
                        </IonSelectOption>
                    ))}
                </IonSelect>
            </IonItem>
            {errors.currency && <p className="text-red-500 text-sm px-4">{errors.currency.message}</p>}

            <IonItem className="mt-4">
                <IonInput
                    // className="mt-2"
                    label="Amount"
                    type="number"
                    labelPlacement="fixed"
                    fill="solid"
                    {...control.register('amount', { required: 'Amount is required', min: 0, valueAsNumber: true })}
                />
            </IonItem>
            {errors.amount && <p className="text-red-500 text-sm px-4">{errors.amount.message}</p>}

            <IonItem className="mt-4">
                <IonLabel position="fixed">Due Date</IonLabel>
                <IonDatetimeButton slot="end" datetime="datetime" />
                <IonModal keepContentsMounted={true}>
                    <Controller
                        control={control}
                        name="due_date"
                        render={({ field }) => (
                            <IonDatetime
                                id="datetime"
                                presentation="date"
                                value={field.value}
                                onIonChange={(e) => field.onChange(e.detail.value)}
                            />
                        )}
                    />
                </IonModal>
            </IonItem>

            <IonItem className="mt-4">
                <IonSelect
                    // className="mt-2"
                    label="Recurrence"
                    labelPlacement="fixed"
                    fill="solid"
                    interface="action-sheet"

                    {...control.register('recurrence')}
                >
                    <IonSelectOption value="monthly">Monthly</IonSelectOption>
                    <IonSelectOption value="quarterly">Quarterly</IonSelectOption>
                    <IonSelectOption value="yearly">Yearly</IonSelectOption>
                    <IonSelectOption value="none">None</IonSelectOption>
                </IonSelect>
            </IonItem>

            <IonItem className="mt-4">
                <IonTextarea
                    // className="mt-2"
                    label="Notes"
                    labelPlacement="fixed"
                    fill="solid"
                    rows={4}
                    {...control.register('notes')}
                />
            </IonItem>

            <IonItem className="mt-4">
                <IonSelect
                    // className="mt-2"
                    label="Reminder"
                    labelPlacement="fixed"
                    fill="solid"
                    {...control.register('reminder', { required: 'Reminder is required' })}
                >
                    <IonSelectOption value="never">Never remind</IonSelectOption>
                    <IonSelectOption value="1">Remind 1 Day before</IonSelectOption>
                    <IonSelectOption value="3">Remind 3 Days before</IonSelectOption>
                    <IonSelectOption value="7">Remind 7 Days before</IonSelectOption>
                </IonSelect>
            </IonItem>
            {errors.reminder && <p className="text-red-500 text-sm px-4">{errors.reminder.message}</p>}

            <div className="flex justify-end gap-2 mt-6">
                <IonButton fill="clear" color="medium" onClick={onCancel}>
                    Cancel
                </IonButton>
                <IonButton type="submit" expand="block">
                    {submitButtonText}
                </IonButton>
            </div>
        </form>
    );
};

export default AddBillForm;
