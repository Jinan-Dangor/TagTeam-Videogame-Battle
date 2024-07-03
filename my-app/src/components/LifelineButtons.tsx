import React, { useEffect, useState } from "react";
import { Lifeline, Player } from "./GameScreen";

interface ILifelineButtonsProps {
    alignment: "right" | "left";
    lifelinesUsed: Map<Player, Lifeline[]>;
    currentPlayer: Player;
    onClickRevealArt: () => void;
    onClickRevealTags: () => void;
    onClickSkip: () => void;
}

const LifelineButtons = ({ alignment, lifelinesUsed, currentPlayer, onClickRevealArt, onClickRevealTags, onClickSkip }: ILifelineButtonsProps) => {
    return (
        <div>
            <div style={{ visibility: !lifelinesUsed.get(currentPlayer)?.includes(Lifeline.RevealArt) ? "visible" : "hidden" }}>
                <button type="button" onClick={onClickRevealArt} style={{ float: alignment }}>
                    Use Art Lifeline
                </button>
                <br />
            </div>
            <div style={{ visibility: !lifelinesUsed.get(currentPlayer)?.includes(Lifeline.RevealTags) ? "visible" : "hidden" }}>
                <button type="button" onClick={onClickRevealTags} style={{ float: alignment }}>
                    Use Tag Lifeline
                </button>
                <br />
            </div>
            <div style={{ visibility: !lifelinesUsed.get(currentPlayer)?.includes(Lifeline.Skip) ? "visible" : "hidden" }}>
                <button type="button" onClick={onClickSkip} style={{ float: alignment }}>
                    Use Skip Lifeline
                </button>
            </div>
        </div>
    );
};

export default LifelineButtons;
