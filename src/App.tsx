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
import { ellipse, list, square, triangle } from 'ionicons/icons';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import HistoryPage from './pages/History';
import Login from './pages/Login';
import ManageBills from './pages/ManageBills';
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
    console.log('No user found, redirecting to login');
    return <Redirect to="/login" />;
  }

  console.log('User authenticated, rendering protected routes');

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
      <IonTabBar slot="bottom">
        <IonTabButton tab="dashboard" href="/dashboard">
          <IonIcon aria-hidden="true" icon={triangle} />
          <IonLabel>Dashboard</IonLabel>
        </IonTabButton>
        <IonTabButton tab="history" href="/history">
          <IonIcon aria-hidden="true" icon={ellipse} />
          <IonLabel>History</IonLabel>
        </IonTabButton>
        <IonTabButton tab="manage-bills" href="/manage-bills">
          <IonIcon aria-hidden="true" icon={list} />
          <IonLabel>Manage Bills</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/settings">
          <IonIcon aria-hidden="true" icon={square} />
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
            <Route exact path="/login">
              <Login />
            </Route>
            <Route exact path="/signup">
              <Signup />
            </Route>
            <Route path="/">
              <ProtectedRoutes />
            </Route>
          </Switch>
        </BrowserRouter>
      </AuthProvider>
    </IonApp>
  </>
);

export default App;
