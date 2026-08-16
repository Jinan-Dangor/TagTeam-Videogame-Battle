import React, { createContext, useContext, useEffect } from "react";
import "../styles/TurnTimer.css";

export const TimerContext = createContext<{ timeLeft: number; setTimeLeft: (t: number) => void }>({ timeLeft: 0, setTimeLeft: (t) => {} });

interface ITurnTimerProps {
    timeLeft: number;
    setTimeLeft: (n: number) => void;
    isCountingDown: boolean;
    setIsCountingDown: (b: boolean) => void;
    onTimerFinished?: () => void;
}

const formatTime = (timeLeftMs: number) => {
    const minutesLeft = Math.floor(timeLeftMs / 1000 / 60);
    const minuteLeadingZero = minutesLeft < 10 ? "0" : "";
    const secondsLeft = Math.floor((timeLeftMs / 1000) % 60);
    const secondLeadingZero = secondsLeft < 10 ? "0" : "";
    return `${minuteLeadingZero}${minutesLeft}:${secondLeadingZero}${secondsLeft}`;
};

const INTERVAL_PERIOD = 100;

const TurnTimer = ({ timeLeft, setTimeLeft, isCountingDown, setIsCountingDown, onTimerFinished = () => {} }: ITurnTimerProps) => {
    const timeContext = useContext(TimerContext);

    const updateTime = () => {
        timeContext.setTimeLeft(timeContext.timeLeft - INTERVAL_PERIOD);
        if (timeContext.timeLeft <= 0) {
            timeContext.setTimeLeft(0);
            setIsCountingDown(false);
            onTimerFinished();
        }
    };

    useEffect(() => {
        let intervalId;
        if (isCountingDown) {
            intervalId = setInterval(() => {
                updateTime();
            }, INTERVAL_PERIOD);
        }
        return () => clearInterval(intervalId);
    }, [isCountingDown, timeContext.timeLeft]);

    return (
        <div className="turn-timer">
            <div className="time">{formatTime(timeContext.timeLeft)}</div>
        </div>
    );
};

export default TurnTimer;
