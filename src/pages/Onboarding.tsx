import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonPage,
    IonText,
    IonTitle,
    IonToggle,
    IonToolbar
} from '@ionic/react';
import { calendarClear, cashOutline, checkmarkCircle, notificationsOutline } from 'ionicons/icons';
import React, { useEffect, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useHistory } from 'react-router-dom';

// Simple swipe implementation using touch events for 4 slides
// Avoids extra deps; good enough for first-time onboarding.

const slides = [
    {
        key: 'toggle',
        title: 'One-tap Payment Toggle',
        description: 'Quickly mark a bill as paid for the month using a single toggle on the dashboard list.',
        render: () => (
            <IonCard className="rounded-2xl shadow-md bg-white/70 dark:bg-gray-800/80">
                <IonCardHeader>
                    <IonCardTitle className="text-xl">One-tap Payment</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                    <div className="flex items-center gap-4">
                        <IonToggle checked={true} enableOnOffLabels={true} />
                        <div>
                            <div className="font-semibold">Electricity Bill</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Mark paid for this month</div>
                        </div>
                    </div>
                </IonCardContent>
            </IonCard>
        ),
        icon: checkmarkCircle,
        accent: 'primary',
    },
    {
        key: 'calendar',
        title: 'Smart Calendar',
        description: 'See your upcoming dues highlighted and tap a date to review bills due that day.',
        render: () => (
            <IonCard className="rounded-2xl shadow-md bg-white/70 dark:bg-gray-800/80">
                <IonCardHeader>
                    <IonCardTitle className="text-xl">Smart Bill Calendar</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                    {(() => {
                        const today = new Date();
                        const mk = (d: Date) => {
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            return `${y}-${m}-${dd}`;
                        };
                        const demoDueDates = new Set([
                            mk(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
                            mk(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)),
                            mk(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6)),
                        ]);
                        return (
                            <div className="dashboard-calendar-container">
                                <Calendar
                                    className="border rounded-2xl shadow-md bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                                    value={today}
                                    onChange={() => { /* demo only */ }}
                                    tileContent={({ date }: { date: Date }) => {
                                        const key = mk(date);
                                        if (demoDueDates.has(key)) {
                                            return (
                                                <div className="mt-1 flex justify-center">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                    tileClassName={({ date }: { date: Date }) => {
                                        const key = mk(date);
                                        return demoDueDates.has(key)
                                            ? 'relative text-blue-700 dark:text-blue-300 font-medium'
                                            : undefined;
                                    }}
                                />
                                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">Blue dots indicate upcoming bill due dates.</div>
                            </div>
                        );
                    })()}
                </IonCardContent>
            </IonCard>
        ),
        icon: calendarClear,
        accent: 'tertiary',
    },
    {
        key: 'reminders',
        title: 'Helpful Reminders',
        description: 'Get timely alerts in your chosen window so you never miss a payment.',
        render: () => (
            <IonCard className="rounded-2xl shadow-md bg-white/70 dark:bg-gray-800/80">
                <IonCardHeader>
                    <IonCardTitle className="text-xl">Smart Reminders</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                    <div className="flex items-center gap-3">
                        <IonIcon icon={notificationsOutline} className="text-2xl text-blue-600 dark:text-blue-400" />
                        <IonText>Notify before due date: 3 days</IonText>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">Customize per bill and per schedule.</div>
                </IonCardContent>
            </IonCard>
        ),
        icon: notificationsOutline,
        accent: 'secondary',
    },
    {
        key: 'add-bills',
        title: 'Quick Add with Multi-currency',
        description: 'Add bills in seconds and track amounts in your preferred currency.',
        render: () => (
            <IonCard className="rounded-2xl shadow-md bg-white/70 dark:bg-gray-800/80">
                <IonCardHeader>
                    <IonCardTitle className="text-xl">Add Bills Fast</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                    <div className="flex items-center gap-3">
                        <IonIcon icon={cashOutline} className="text-2xl text-emerald-600 dark:text-emerald-400" />
                        <IonText>Supports USD • EUR • INR and more</IonText>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">Keep totals accurate across currencies.</div>
                </IonCardContent>
            </IonCard>
        ),
        icon: cashOutline,
        accent: 'success',
    },
];

const Onboarding: React.FC = () => {
    const history = useHistory();
    const [index, setIndex] = useState(0);
    const [startX, setStartX] = useState<number | null>(null);
    const [deltaX, setDeltaX] = useState(0);
    const [transitionEnabled, setTransitionEnabled] = useState(true);
    const slideWrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Respect system dark mode and Tailwind sync already handled in App
    }, []);

    const goLogin = () => {
        localStorage.setItem('hasOnboarded', 'true');
        history.replace('/login');
    };

    const handleGetStarted = () => {
        localStorage.setItem('hasOnboarded', 'true');
        history.replace('/login');
    };

    const onTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
        setTransitionEnabled(false);
        setDeltaX(0);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (startX == null) return;
        const currentX = e.touches[0].clientX;
        setDeltaX(currentX - startX);
    };

    const animateToIndex = (nextIndex: number, direction: 1 | -1) => {
        const width = slideWrapRef.current?.offsetWidth || window.innerWidth;
        setTransitionEnabled(true);
        // Slide out
        setDeltaX(-direction * width);
        setTimeout(() => {
            // Jump to next and position off-screen other side
            setTransitionEnabled(false);
            setIndex(nextIndex);
            setDeltaX(direction * width);
            // Slide in
            requestAnimationFrame(() => {
                setTransitionEnabled(true);
                setDeltaX(0);
            });
        }, 180);
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (startX == null) return;
        const delta = e.changedTouches[0].clientX - startX;
        const threshold = 50;
        if (delta < -threshold && index < slides.length - 1) {
            animateToIndex(index + 1, 1);
        } else if (delta > threshold && index > 0) {
            animateToIndex(index - 1, -1);
        } else {
            // Snap back
            setTransitionEnabled(true);
            setDeltaX(0);
        }
        setStartX(null);
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Welcome to MonthWise</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent fullscreen className="ion-padding" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                <div className="flex flex-col items-center justify-between min-h-full">
                    <div className="w-full max-w-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <IonIcon icon={slides[index].icon} className="text-2xl" color={slides[index].accent as any} />
                            <IonText className="text-xl font-semibold">{slides[index].title}</IonText>
                        </div>
                        <IonText color="medium">{slides[index].description}</IonText>
                    </div>

                    <div className="w-full max-w-xl mt-6 overflow-hidden" ref={slideWrapRef}>
                        <div
                            style={{
                                transform: `translateX(${deltaX}px)`,
                                transition: transitionEnabled ? 'transform 220ms ease-out' : 'none',
                            }}
                        >
                            {slides[index].render()}
                        </div>
                    </div>

                    {/* Dots */}
                    <div className="flex items-center gap-2 mt-6">
                        {slides.map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 rounded-full ${i === index ? 'w-6 bg-blue-600 dark:bg-blue-400' : 'w-2 bg-gray-300 dark:bg-gray-600'}`}
                            />
                        ))}
                    </div>

                </div>
            </IonContent>
            <IonFooter className="ion-padding">
                <div className="w-full max-w-xl mx-auto flex items-center justify-between">
                    <IonButton fill="clear" color="medium" onClick={goLogin}>
                        Skip
                    </IonButton>
                    <div className="flex items-center gap-2">
                        <IonButton
                            color="primary"
                            onClick={() => (index > 0 ? animateToIndex(index - 1, -1) : null)}
                            disabled={index === 0}
                        >
                            Prev
                        </IonButton>
                        {index < slides.length - 1 ? (
                            <IonButton color="primary" onClick={() => animateToIndex(index + 1, 1)}>
                                Next
                            </IonButton>
                        ) : (
                            <IonButton color="success" onClick={handleGetStarted}>
                                Get Started
                            </IonButton>
                        )}
                    </div>
                </div>
            </IonFooter>
        </IonPage>
    );
};

export default Onboarding;