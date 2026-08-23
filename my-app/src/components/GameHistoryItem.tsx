import React, { useState } from "react";
import "../styles/GameHistoryItem.css";
import { GameData, Lifeline, Player, TagData, getReleaseYearString } from "./GameScreen";
import steamLogo from "../assets/steam_logo.png";

interface IGameHistoryItemProps {
    id: string;
    gameNumber: number;
    data: GameData;
    tagData: { [id: string]: TagData };
    lifelinesUsed: Lifeline[];
    viewDetailsButtonVisible: boolean;
    player: Player;
    showStoreLink?: boolean;
}

const GameHistoryItem = ({ id, gameNumber, data, tagData, lifelinesUsed, viewDetailsButtonVisible, player, showStoreLink = false }: IGameHistoryItemProps) => {
    const [viewDetailsClicked, setViewDetailsClicked] = useState(false);

    return (
        <div className={`game-history-item ${player === Player.P1 ? "player-one" : "player-two"}`}>
            <div className="game-counter">#{gameNumber}</div>
            <div className="game-history-container">
                {(lifelinesUsed.includes(Lifeline.RevealArt) || viewDetailsClicked || gameNumber == 1) && (
                    <div className="revealed-art-container">
                        <img className="revealed-art" src={`https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`} />
                    </div>
                )}
                <div className="game-details">
                    <div className="game-title">
                        {data.name} {getReleaseYearString(data)}{" "}
                        {showStoreLink && (
                            <a target="_blank" href={`https://store.steampowered.com/app/${id}`}>
                                <img src={steamLogo} style={{ height: "19px", verticalAlign: "bottom", marginBottom: "2px" }} />
                            </a>
                        )}
                    </div>
                    {(lifelinesUsed.includes(Lifeline.RevealTags) || viewDetailsClicked || gameNumber == 1) && (
                        <div className="revealed-tags">
                            {" "}
                            {data.tag_ids.map((tag) => {
                                if (Object.keys(tagData).includes(tag)) {
                                    return (
                                        <div key={tag} className={"revealed-tag"}>
                                            {tagData[tag].name}
                                        </div>
                                    );
                                } else {
                                    console.log(`Messed up tag is ${tag}`);
                                }
                            })}{" "}
                        </div>
                    )}
                    {viewDetailsButtonVisible && !viewDetailsClicked && !(lifelinesUsed.includes(Lifeline.RevealArt) && lifelinesUsed.includes(Lifeline.RevealTags) && gameNumber == 1) && (
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
