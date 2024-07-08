import React from "react";
import "../styles/LifelineButtons.css";
import { Lifeline, Player } from "./GameScreen";

interface ILifelineButtonsProps {
    lifelinesUsed: Map<Player, Lifeline[]>;
    currentPlayer: Player;
    onClickRevealArt: () => void;
    onClickRevealTags: () => void;
    onClickSkip: () => void;
}

const LifelineButtons = ({ lifelinesUsed, currentPlayer, onClickRevealArt, onClickRevealTags, onClickSkip }: ILifelineButtonsProps) => {
    return (
        <div className="lifeline-buttons">
            <div
                className={`lifeline-button-container ${currentPlayer === Player.P1 ? "player-one" : "player-two"}`}
                style={{ visibility: !lifelinesUsed.get(currentPlayer)?.includes(Lifeline.RevealArt) ? "visible" : "hidden" }}
            >
                <button className="lifeline-button" type="button" onClick={onClickRevealArt}>
                    Use Art Lifeline
                </button>
            </div>
            <div
                className={`lifeline-button-container ${currentPlayer === Player.P1 ? "player-one" : "player-two"}`}
                style={{ visibility: !lifelinesUsed.get(currentPlayer)?.includes(Lifeline.RevealTags) ? "visible" : "hidden" }}
            >
                <button className="lifeline-button" type="button" onClick={onClickRevealTags}>
                    Use Tag Lifeline
                </button>
            </div>
            <div
                className={`lifeline-button-container ${currentPlayer === Player.P1 ? "player-one" : "player-two"}`}
                style={{ visibility: !lifelinesUsed.get(currentPlayer)?.includes(Lifeline.Skip) ? "visible" : "hidden" }}
            >
                <button className="lifeline-button" type="button" onClick={onClickSkip}>
                    Use Skip Lifeline
                </button>
            </div>
        </div>
    );
};

export default LifelineButtons;
