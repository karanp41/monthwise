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
    IonTextarea,
} from '@ionic/react';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Bill, Category } from '../models/types';
import { categoryService } from '../services/categoryService';

interface AddBillFormProps {
    onSubmit: (data: Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_paid'>) => void;
    onCancel: () => void;
}

const AddBillForm: React.FC<AddBillFormProps> = ({ onSubmit, onCancel }) => {
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const { control, handleSubmit, formState: { errors } } = useForm<Omit<Bill, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_paid'>>({
        defaultValues: {
            recurrence: 'monthly',
            due_date: new Date().toISOString(),
        }
    });

    useEffect(() => {
        if (user) {
            categoryService.getCategories(user.id).then(setCategories).catch(console.error);
        }
    }, [user]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="p-4">
            <IonItem>
                <IonInput
                    label="Bill Name"
                    labelPlacement="floating"
                    fill="outline"
                    {...control.register('name', { required: 'Name is required' })}
                />
            </IonItem>
            {errors.name && <p className="text-red-500 text-sm px-4">{errors.name.message}</p>}

            <IonItem className="mt-4">
                <IonSelect
                    label="Category"
                    labelPlacement="floating"
                    fill="outline"
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
                <IonInput
                    label="Amount"
                    type="number"
                    labelPlacement="floating"
                    fill="outline"
                    {...control.register('amount', { required: 'Amount is required', min: 0, valueAsNumber: true })}
                />
            </IonItem>
            {errors.amount && <p className="text-red-500 text-sm px-4">{errors.amount.message}</p>}

            <IonItem className="mt-4">
                <IonLabel position="stacked">Due Date</IonLabel>
                <IonDatetimeButton datetime="datetime" />
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
                    label="Recurrence"
                    labelPlacement="floating"
                    fill="outline"
                    {...control.register('recurrence')}
                >
                    <IonSelectOption value="monthly">Monthly</IonSelectOption>
                    <IonSelectOption value="yearly">Yearly</IonSelectOption>
                    <IonSelectOption value="none">None</IonSelectOption>
                </IonSelect>
            </IonItem>

            <IonItem className="mt-4">
                <IonTextarea
                    label="Notes"
                    labelPlacement="floating"
                    fill="outline"
                    {...control.register('notes')}
                />
            </IonItem>

            <div className="flex justify-end gap-2 mt-6">
                <IonButton fill="clear" color="medium" onClick={onCancel}>
                    Cancel
                </IonButton>
                <IonButton type="submit" expand="block">
                    Add Bill
                </IonButton>
            </div>
        </form>
    );
};

export default AddBillForm;
