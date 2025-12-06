import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
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
import './Login.css';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const history = useHistory();
    const [presentToast] = useIonToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await signIn(email, password);
            history.push('/dashboard');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to log in';
            presentToast({
                message,
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
                <div className="flex items-center justify-center min-h-full">
                    <IonCard className="w-full max-w-md">
                        <IonCardHeader className="text-center">
                            <img
                                src="/monthwise-logo.png"
                                alt="MonthWise Logo"
                                className="mx-auto mb-4 h-16 w-auto"
                            />
                            {/* <IonCardTitle className="text-center text-2xl">
                                Welcome to MonthWise
                            </IonCardTitle> */}
                        </IonCardHeader>
                        <IonCardContent>
                            <form onSubmit={handleLogin}>
                                <IonItem>
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
                                    {loading ? 'Logging in...' : 'Log In'}
                                </IonButton>
                            </form>
                            <div className="text-center mt-4">
                                <IonText color="medium">
                                    Don't have an account?{' '}
                                </IonText>
                                <IonButton
                                    fill="clear"
                                    size="small"
                                    onClick={() => history.push('/signup')}
                                >
                                    Sign Up
                                </IonButton>
                            </div>
                        </IonCardContent>
                    </IonCard>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Login;
