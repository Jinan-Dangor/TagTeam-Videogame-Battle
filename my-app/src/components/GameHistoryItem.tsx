import React, { useState } from "react";
import "../styles/GameHistoryItem.css";
import { GameData, Lifeline, Player, TagData, getReleaseYearString } from "./GameScreen";

interface IGameHistoryItemProps {
    id: string;
    data: GameData;
    tagData: { [id: string]: TagData };
    lifelinesUsed: Lifeline[];
    viewDetailsButtonVisible: boolean;
    player: Player;
}

const GameHistoryItem = ({ id, data, tagData, lifelinesUsed, viewDetailsButtonVisible, player }: IGameHistoryItemProps) => {
    const [viewDetailsClicked, setViewDetailsClicked] = useState(false);

    return (
        <div className={`game-history-item ${player === Player.P1 ? "player-one" : "player-two"}`}>
            <div className="game-history-container">
                {(lifelinesUsed.includes(Lifeline.RevealArt) || viewDetailsClicked) && (
                    <div className="revealed-art-container">
                        <img className="revealed-art" src={`https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`} />
                    </div>
                )}
                <div className="game-details">
                    <div className="game-title">
                        {data.name} {getReleaseYearString(data)}
                    </div>
                    {(lifelinesUsed.includes(Lifeline.RevealTags) || viewDetailsClicked) && (
                        <div className="revealed-tags">
                            {" "}
                            {data.tag_ids.map((tag) => {
                                return (
                                    <div key={tag} className={"revealed-tag"}>
                                        {tagData[tag].name}
                                    </div>
                                );
                            })}{" "}
                        </div>
                    )}
                    {viewDetailsButtonVisible && !viewDetailsClicked && !(lifelinesUsed.includes(Lifeline.RevealArt) && lifelinesUsed.includes(Lifeline.RevealTags)) && (
                        <div
                            className="view-details-button"
                            onClick={() => {
                                setViewDetailsClicked(true);
                            }}
                        >
                            View Details
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameHistoryItem;
