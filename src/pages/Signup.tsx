import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonInput,
    IonItem,
    IonPage,
    IonText,
    useIonToast
} from '@ionic/react';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Signup: React.FC = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const history = useHistory();
    const [presentToast] = useIonToast();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await signUp(email, password, name);
            presentToast({
                message: 'Account created successfully!',
                duration: 2000,
                color: 'success',
            });
            // Once user signs up, consider onboarding complete
            localStorage.setItem('hasOnboarded', 'true');
            history.push('/dashboard');
        } catch (error: any) {
            presentToast({
                message: error.message || 'Failed to create account',
                duration: 3000,
                color: 'danger',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <IonPage>
            <IonContent className="ion-padding">
                <div className="flex flex-col  items-center justify-center min-h-full">
                    <img
                        src="/monthwise-logo-tagline.png"
                        alt="MonthWise Logo"
                        className="mx-auto h-128 w-auto"
                    />
                    <IonCard className="w-full max-w-md">
                        <IonCardHeader>
                            <IonCardTitle className="text-center text-2xl">
                                Create Account
                            </IonCardTitle>
                        </IonCardHeader>
                        <IonCardContent>
                            <form onSubmit={handleSignup}>
                                <IonItem>
                                    <IonInput
                                        type="text"
                                        label="Name"
                                        labelPlacement="floating"
                                        value={name}
                                        onIonInput={(e) => setName(e.detail.value!)}
                                        required
                                    />
                                </IonItem>
                                <IonItem className="mt-4">
                                    <IonInput
                                        type="email"
                                        label="Email"
                                        labelPlacement="floating"
                                        value={email}
                                        onIonInput={(e) => setEmail(e.detail.value!)}
                                        required
                                    />
                                </IonItem>
                                <IonItem className="mt-4">
                                    <IonInput
                                        type="password"
                                        label="Password"
                                        labelPlacement="floating"
                                        value={password}
                                        onIonInput={(e) => setPassword(e.detail.value!)}
                                        required
                                    />
                                </IonItem>
                                <IonButton
                                    expand="block"
                                    type="submit"
                                    className="mt-6"
                                    disabled={loading}
                                >
                                    {loading ? 'Creating Account...' : 'Sign Up'}
                                </IonButton>
                            </form>
                            <div className="text-center mt-4">
                                <IonText color="medium">
                                    Already have an account?{' '}
                                </IonText>
                                <IonButton
                                    fill="clear"
                                    size="small"
                                    onClick={() => history.push('/login')}
                                >
                                    Log In
                                </IonButton>
                                <div className="mt-2">
                                    <IonButton fill="clear" size="small" onClick={() => history.push('/onboarding')}>
                                        Learn More
                                    </IonButton>
                                </div>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Signup;
