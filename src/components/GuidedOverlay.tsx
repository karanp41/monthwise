import React, { useEffect, useLayoutEffect, useState } from 'react';

interface GuidedOverlayProps {
    targetSelector?: string; // CSS selector for target to highlight
    title: string;
    description: string;
    primaryText?: string;
    secondaryText?: string;
    onPrimary: () => void;
    onSecondary?: () => void;
}

// Lightweight spotlight overlay that highlights a target element (if present)
// and shows a message card with actions. Avoids extra deps.
export const GuidedOverlay: React.FC<GuidedOverlayProps> = ({
    targetSelector,
    title,
    description,
    primaryText = 'Next',
    secondaryText,
    onPrimary,
    onSecondary,
}) => {
    const [rect, setRect] = useState<DOMRect | null>(null);

    const recalc = () => {
        if (!targetSelector) {
            setRect(null);
            return;
        }
        const el = document.querySelector(targetSelector) as HTMLElement | null;
        if (el) {
            const r = el.getBoundingClientRect();
            setRect(r);
        } else {
            setRect(null);
        }
    };

    useLayoutEffect(() => {
        recalc();
        const onResize = () => recalc();
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onResize, true);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onResize, true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetSelector]);

    useEffect(() => {
        // prevent background scrolling
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                zIndex: 9999,
            }}
        >
            {rect && (
                <div
                    style={{
                        position: 'fixed',
                        left: rect.left - 8,
                        top: rect.top - 8,
                        width: rect.width + 16,
                        height: rect.height + 16,
                        borderRadius: 16,
                        boxShadow: '0 0 0 200vmax rgba(0,0,0,0.6)',
                        outline: '2px solid #60a5fa',
                        transition: 'all 150ms ease-out',
                        pointerEvents: 'none',
                    }}
                />
            )}

            <div
                style={{
                    position: 'fixed',
                    left: '50%',
                    bottom: 102,
                    transform: 'translateX(-50%)',
                    background: 'white',
                    color: '#111827',
                    borderRadius: 16,
                    maxWidth: 520,
                    width: 'calc(100% - 32px)',
                    padding: 16,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                    zIndex: 10000,
                }}
                className="dark:bg-gray-800 dark:text-gray-100"
            >
                <div className="text-lg font-semibold mb-1">{title}</div>
                <div className="text-sm opacity-90 mb-3">{description}</div>
                <div className="flex gap-2 justify-end">
                    {secondaryText && onSecondary && (
                        <button
                            onClick={onSecondary}
                            className="px-3 py-2 rounded-md bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                        >
                            {secondaryText}
                        </button>
                    )}
                    <button
                        onClick={onPrimary}
                        className="px-3 py-2 rounded-md bg-blue-600 text-white"
                    >
                        {primaryText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuidedOverlay;
