import React from "react";
import "../styles/GameHistoryItem.css";
import { GameData, Lifeline, TagData, getReleaseYearString } from "./GameScreen";

interface IGameHistoryItemProps {
    id: string;
    data: GameData;
    tagData: { [id: string]: TagData };
    lifelinesUsed: Lifeline[];
}

const GameHistoryItem = ({ id, data, tagData, lifelinesUsed }: IGameHistoryItemProps) => {
    return (
        <div className="game-history-item">
            <div className="game-history-container">
                {lifelinesUsed.includes(Lifeline.RevealArt) && (
                    <div className="revealed-art-container">
                        <img className="revealed-art" src={`https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`} />
                    </div>
                )}
                <div className="game-details">
                    <div className="game-title">
                        {data.name} {getReleaseYearString(data)}
                    </div>
                    {lifelinesUsed.includes(Lifeline.RevealTags) && (
                        <div className="revealed-tags">
                            {" "}
                            {data.tag_ids.map((tag) => {
                                return (
                                    <div key={tag} className="revealed-tag">
                                        {tagData[tag].name}
                                    </div>
                                );
                            })}{" "}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameHistoryItem;
