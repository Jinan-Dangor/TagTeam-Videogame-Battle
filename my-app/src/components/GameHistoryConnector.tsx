import React from "react";
import "../styles/GameHistoryConnector.css";
import { Player } from "./GameScreen";

interface IGameHistoryConnectorProps {
    player: Player;
}

const GameHistoryConnector = ({ player }: IGameHistoryConnectorProps) => {
    return <div className={`game-history-connector ${player === Player.P1 ? "player-one" : "player-two"}`} />;
};

export default GameHistoryConnector;
