import React, { useEffect, useState } from "react";

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
    const updateTime = () => {
        setTimeLeft(timeLeft - INTERVAL_PERIOD);
        if (timeLeft <= 0) {
            setTimeLeft(0);
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
    }, [isCountingDown, timeLeft]);

    return (
        <div>
            <div>{formatTime(timeLeft)}</div>
        </div>
    );
};

export default TurnTimer;
