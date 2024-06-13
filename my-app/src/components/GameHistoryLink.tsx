import React from "react";
import { GameData, getReleaseYearString } from "./GameScreen";

interface IGameHistoryItemProps {
    messages: String[];
}

const GameHistoryItem = ({ messages }: IGameHistoryItemProps) => {
    return (
        <div style={{ borderWidth: "5px", borderColor: "black", borderStyle: "solid", width: "15%", margin: "auto", borderRadius: "10px", backgroundColor: "grey" }}>
            {messages.map((message, index) => {
                return <p key={index}>{message}</p>;
            })}
        </div>
    );
};

export default GameHistoryItem;
