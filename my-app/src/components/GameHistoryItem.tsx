import React from "react";
import { GameData, getReleaseYearString } from "./GameScreen";

interface IGameHistoryItemProps {
    data: GameData;
}

const GameHistoryItem = ({ data }: IGameHistoryItemProps) => {
    return (
        <div style={{ borderWidth: "5px", borderColor: "black", borderStyle: "solid", width: "20%", margin: "auto", borderRadius: "10px", backgroundColor: "grey" }}>
            <p>
                {data.name} {getReleaseYearString(data)}
            </p>
        </div>
    );
};

export default GameHistoryItem;
