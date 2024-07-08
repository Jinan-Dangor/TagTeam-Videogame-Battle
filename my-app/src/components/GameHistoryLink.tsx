import React from "react";
import "../styles/GameHistoryLink.css";
import { GameLinkHistoryEntry, MatchType, TagData, unescapeChars } from "./GameScreen";

interface IGameHistoryItemProps {
    gameLinkHistoryEntry: GameLinkHistoryEntry;
    tagData: { [id: string]: TagData };
}

interface IStrikeTicksProps {
    numStrikes: number;
}

const StrikeTicks = ({ numStrikes }: IStrikeTicksProps) => {
    return <div>{`${[1, 2, 3].map((num) => (numStrikes >= num ? String.fromCodePoint(0x2611) : String.fromCodePoint(0x2610))).join("")}`}</div>;
};

const GameHistoryItem = ({ gameLinkHistoryEntry, tagData }: IGameHistoryItemProps) => {
    return (
        <div className="game-history-link">
            {(gameLinkHistoryEntry?.match.type === MatchType.Tags || gameLinkHistoryEntry?.match.type === MatchType.Creators) &&
                (gameLinkHistoryEntry?.match.type === MatchType.Tags
                    ? gameLinkHistoryEntry?.match.tag_ids?.map((tag) => `${unescapeChars(tagData[tag].name)} ${tagData[tag].emoji}`) ?? []
                    : gameLinkHistoryEntry?.match.creators?.map((creator) => `${creator}`) ?? []
                ).map((line, index) => {
                    return (
                        <div key={index}>
                            <div key={index}>{line}</div>
                            <StrikeTicks numStrikes={gameLinkHistoryEntry.counts[index]} />
                        </div>
                    );
                })}
            {gameLinkHistoryEntry?.match.type === MatchType.Skip && <div>Skipped</div>}
        </div>
    );
};

export default GameHistoryItem;
