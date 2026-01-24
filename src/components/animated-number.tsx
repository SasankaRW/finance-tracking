"use client";

import * as React from "react";

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    formatFn?: (value: number) => string;
    className?: string;
}

export function AnimatedNumber({
    value,
    duration = 1000,
    formatFn,
    className = "",
}: AnimatedNumberProps) {
    const [displayValue, setDisplayValue] = React.useState(0);
    const [hasAnimated, setHasAnimated] = React.useState(false);

    React.useEffect(() => {
        if (hasAnimated) {
            setDisplayValue(value);
            return;
        }

        const startTime = Date.now();
        const startValue = 0;
        const endValue = value;

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out cubic)
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const current = startValue + (endValue - startValue) * easeOutCubic;

            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setHasAnimated(true);
            }
        };

        const timeoutId = setTimeout(() => {
            requestAnimationFrame(animate);
        }, 100); // Small delay for better effect

        return () => clearTimeout(timeoutId);
    }, [value, duration, hasAnimated]);

    const formattedValue = formatFn ? formatFn(displayValue) : Math.round(displayValue).toLocaleString();

    return <span className={className}>{formattedValue}</span>;
}
