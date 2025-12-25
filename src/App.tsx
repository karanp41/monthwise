import { PushNotifications } from '@capacitor/push-notifications';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonToast,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { home, receiptOutline, settingsOutline, timeOutline } from 'ionicons/icons';
import React, { useEffect, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import Login from './pages/Login';
import ManageBills from './pages/ManageBills';
import Onboarding from './pages/Onboarding';
import AddFirstBill from './pages/onboarding/AddFirstBill';
import SelectCurrency from './pages/onboarding/SelectCurrency';
import Settings from './pages/Settings';
import Signup from './pages/Signup';
import { supabase } from './services/supabase';
import { userService } from './services/userService';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/display.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/global.css';
import './theme/variables.css';

setupIonicReact();

// Sync Tailwind dark mode with Ionic dark mode
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const updateDarkMode = () => {
  if (prefersDark.matches) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};
updateDarkMode();
prefersDark.addEventListener('change', updateDarkMode);

const MainTabs: React.FC = () => {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/dashboard" component={Dashboard} />
        <Route exact path="/history" component={HistoryPage} />
        <Route exact path="/manage-bills" component={ManageBills} />
        <Route exact path="/settings" component={Settings} />
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="fixed bottom-4 left-4 right-4 bg-white/60 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg rounded-3xl px-4 py-2 border border-gray-200 dark:border-gray-700">
        <IonTabButton tab="dashboard" href="/dashboard" className='bg-transparent'>
          <IonIcon aria-hidden="true" icon={home} />
          <IonLabel>Home</IonLabel>
        </IonTabButton>
        <IonTabButton tab="manage-bills" href="/manage-bills" className='bg-transparent'>
          <IonIcon aria-hidden="true" icon={receiptOutline} />
          <IonLabel>Bills</IonLabel>
        </IonTabButton>
        <IonTabButton tab="history" href="/history" className='bg-transparent'>
          <IonIcon aria-hidden="true" icon={timeOutline} />
          <IonLabel>History</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/settings" className='bg-transparent'>
          <IonIcon aria-hidden="true" icon={settingsOutline} />
          <IonLabel>Settings</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

const ProtectedRoute: React.FC<{ component: React.ComponentType<any>; path: string; exact?: boolean }> = ({
  component: Component,
  ...rest
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <IonSpinner />
      </div>
    );
  }

  return (
    <Route
      {...rest}
      render={(props) =>
        user ? <Component {...props} /> : <Redirect to="/login" />
      }
    />
  );
};

const App: React.FC = () => {
  const hasOnboarded = localStorage.getItem('hasOnboarded') === 'true';
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    let registrationListener: any = null;
    let regErrorListener: any = null;
    let receivedListener: any = null;
    let actionListener: any = null;

    const initializePush = async () => {
      try {
        // 1. Check/request permissions
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log('Push permissions not granted');
          return;
        }

        // 2. Register with APNs/FCM
        await PushNotifications.register();

        // 3. Listeners
        registrationListener = PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token: ' + token.value);
          try {
            const { data } = await supabase.auth.getUser();
            const userId = data?.user?.id ?? null;
            if (userId) {
              // Save token to the backend for this authenticated user
              await userService.savePushToken(userId, token.value);
            } else {
              // No user yet — persist locally and attach after signup/login
              localStorage.setItem('pendingPushToken', token.value);
            }
          } catch (e) {
            console.error('Error saving push token', e);
            localStorage.setItem('pendingPushToken', token.value);
          }
        });

        regErrorListener = PushNotifications.addListener('registrationError', err => {
          console.error('Push registration error: ', err);
        });

        receivedListener = PushNotifications.addListener('pushNotificationReceived', notification => {
          console.log('Push received: ', notification);
          // Show an in-app toast when a notification arrives while app is in foreground
          const title = (notification?.title) ? `${notification.title}` : '';
          const body = (notification?.body) ? `${notification.body}` : '';
          const msg = title ? `${title} — ${body}` : body || JSON.stringify(notification?.data || notification);
          setToastMessage(msg);
          setToastOpen(true);
        });

        actionListener = PushNotifications.addListener('pushNotificationActionPerformed', action => {
          console.log('Push action performed: ', action);
          // You can navigate based on `action.notification.data` if needed
          const title = (action?.notification?.title) ? `${action.notification.title}` : '';
          const body = (action?.notification?.body) ? `${action.notification.body}` : '';
          const msg = title ? `${title} — ${body}` : body || JSON.stringify(action?.notification?.data || action);
          setToastMessage(msg);
          setToastOpen(true);
        });
      } catch (e) {
        console.error('Error initializing push notifications', e);
      }
    };

    initializePush();

    return () => {
      // cleanup listeners
      try {
        registrationListener?.remove?.();
        regErrorListener?.remove?.();
        receivedListener?.remove?.();
        actionListener?.remove?.();
      } catch (e: any) {
        console.error('Error cleaning up push listeners', e);
        // ignore cleanup errors
      }
    };
  }, []);

  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            {/* Public routes */}
            <Route exact path="/onboarding" component={Onboarding} />
            <Route exact path="/onboarding/currency" component={SelectCurrency} />
            <Route exact path="/onboarding/add-bill" component={AddFirstBill} />
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />

            {/* Root redirect */}
            <Route
              exact
              path="/"
              render={() => {
                return hasOnboarded ? (
                  <Redirect to="/dashboard" />
                ) : (
                  <Redirect to="/onboarding" />
                );
              }}
            />

            {/* Protected tab routes */}
            <ProtectedRoute path="/dashboard" component={MainTabs} />
            <ProtectedRoute path="/history" component={MainTabs} />
            <ProtectedRoute path="/manage-bills" component={MainTabs} />
            <ProtectedRoute path="/settings" component={MainTabs} />
          </IonRouterOutlet>
        </IonReactRouter>
      </AuthProvider>
      <IonToast
        isOpen={toastOpen}
        message={toastMessage}
        onDidDismiss={() => setToastOpen(false)}
        duration={4000}
      />
    </IonApp>
  );
};

export default App;