import React from "react";
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
        <div
            style={{
                borderWidth: "5px",
                borderColor: "black",
                borderStyle: "solid",
                width: "15%",
                margin: "auto",
                borderRadius: "10px",
                backgroundColor: "grey",
            }}
        >
            {(gameLinkHistoryEntry?.match.type === MatchType.Tags
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
        </div>
    );
};

export default GameHistoryItem;
