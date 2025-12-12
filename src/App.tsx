import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { home, receiptOutline, settingsOutline, timeOutline } from 'ionicons/icons';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import Login from './pages/Login';
import ManageBills from './pages/ManageBills';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import Signup from './pages/Signup';

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

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
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

const ProtectedRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <IonSpinner />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/dashboard">
          <Dashboard />
        </Route>
        <Route exact path="/history">
          <HistoryPage />
        </Route>
        <Route exact path="/manage-bills">
          <ManageBills />
        </Route>
        <Route path="/settings">
          <Settings />
        </Route>
        <Route exact path="/">
          <Redirect to="/dashboard" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="fixed bottom-4 left-4 right-4 bg-white/60 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg rounded-3xl px-4 py-2 border border-gray-200 dark:border-gray-700">
        <IonTabButton tab="dashboard" href="/dashboard" className="bg-transparent">
          <IonIcon aria-hidden="true" icon={home} />
          <IonLabel>Home</IonLabel>
        </IonTabButton>
        <IonTabButton tab="manage-bills" href="/manage-bills" className="bg-transparent">
          <IonIcon aria-hidden="true" icon={receiptOutline} />
          <IonLabel>Bills</IonLabel>
        </IonTabButton>
        <IonTabButton tab="history" href="/history" className="bg-transparent">
          <IonIcon aria-hidden="true" icon={timeOutline} />
          <IonLabel>History</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/settings" className="bg-transparent">
          <IonIcon aria-hidden="true" icon={settingsOutline} />
          <IonLabel>Settings</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

const App: React.FC = () => (
  <>
    <IonApp>
      <AuthProvider>
        <BrowserRouter>
          <Switch>
            {/* First-time onboarding, only when not logged in and not completed */}
            <Route exact path="/onboarding">
              <Onboarding />
            </Route>
            <Route exact path="/login">
              <Login />
            </Route>
            <Route exact path="/signup">
              <Signup />
            </Route>
            <Route path="/">
              <Route
                exact
                path="/"
                render={() => {
                  const hasOnboarded = localStorage.getItem('hasOnboarded') === 'true';
                  return hasOnboarded ? (
                    <Redirect to="/dashboard" />
                  ) : (
                    <Redirect to="/onboarding" />
                  );
                }}
              />
              <ProtectedRoutes />
            </Route>
          </Switch>
        </BrowserRouter>
      </AuthProvider>
    </IonApp>
  </>
);

export default App;
