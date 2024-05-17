import React, { useEffect, useState } from "react";
import tags from "../scripts/scrapedTags.json";
import AutocompleteInput from "./AutocompleteInput";

type GameData = {
    name: string;
    developers: string[];
    publishers: string[];
    tag_ids: number[];
    has_release_date: boolean;
    steam_release_state: string;
    steam_release_date: number;
    review_score: number;
    review_percentage: number;
};

type TagData = {
    name: string;
    emoji: string;
};

type AutocompleteData = {
    id: string;
    name: string;
    year_text: string;
    review_percentage: number;
};

function unescapeChars(str: string) {
    return new DOMParser().parseFromString(str, "text/html").documentElement
        .textContent;
}

function getReleaseYearString(game: GameData) {
    if (!game.has_release_date) {
        return "";
    }
    if (game.steam_release_date == 0) {
        return "Coming Soon";
    }
    return `${getYear(game.steam_release_date)}`;
}

function getYear(unix: number) {
    return new Date(unix * 1000).getFullYear();
}

const GameScreen = () => {
    const [lastGameId, setLastGameId] = useState<string>("440");
    const [currentGameId, setCurrentGameId] = useState<string>("");
    const [nameSearchTerm, setNameSearchTerm] = useState<string>("");
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [suggestions, setSuggestions] = useState<AutocompleteData[]>([]);
    let tag_data: { [id: string]: TagData } = {};
    tags.forEach(
        (tag) => (tag_data[tag.ID] = { name: tag.name, emoji: tag.emoji })
    );

    useEffect(() => {
        if (nameSearchTerm == "") {
            return;
        }
        fetch(
            `http://127.0.0.1:3001/?autocomplete_games=${nameSearchTerm}`
        ).then(async (response) => {
            const response_json = await response.json();
            if (response_json.responses[0].success) {
                const autocomplete_data = response_json.responses[0];
                setSuggestions(autocomplete_data.valid_games);
                console.log(autocomplete_data.valid_games);
            }
        });
    }, [nameSearchTerm]);

    useEffect(() => {
        if (currentGameId != "") {
            search_for_game();
        }
    }, [currentGameId]);

    const search_for_game = () => {
        fetch(`http://127.0.0.1:3001/?game_info=${currentGameId}`).then(
            async (response) => {
                const response_json = await response.json();
                if (response_json.responses[0].success) {
                    const game_data = response_json.responses[0];
                    setGameData(game_data);
                }
            }
        );
    };

    return (
        <div className="App">
            <h1>Singleplayer Battle Test</h1>
            <div>
                <AutocompleteInput
                    value={nameSearchTerm}
                    setValue={(value) => {
                        setCurrentGameId(value);
                    }}
                    suggestions={suggestions.map((suggestion) => {
                        return {
                            label: `${suggestion.name} ${
                                suggestion.year_text != ""
                                    ? `(${suggestion.year_text})`
                                    : ""
                            }`,
                            search_term: suggestion.name,
                            value: suggestion.id,
                        };
                    })}
                    onChange={(e) => setNameSearchTerm(e.target.value)}
                    onSelectSuggestion={(value) => {
                        setNameSearchTerm(value);
                    }}
                />
                <button
                    type="button"
                    onClick={() => {
                        setNameSearchTerm(suggestions[0].name);
                        setCurrentGameId(suggestions[0].id);
                        search_for_game();
                    }}
                >
                    Search by Name
                </button>
            </div>
            {gameData && (
                <div>
                    <table
                        style={{
                            width: "60%",
                            marginLeft: "auto",
                            marginRight: "auto",
                        }}
                    >
                        <tr>
                            <td>
                                <img
                                    src={`https://cdn.akamai.steamstatic.com/steam/apps/${currentGameId}/header.jpg`}
                                ></img>
                            </td>
                            <td style={{ textAlign: "left" }}>
                                <p>
                                    You chose the game {gameData.name}{" "}
                                    {gameData.has_release_date && (
                                        <span>
                                            {getReleaseYearString(gameData)}
                                        </span>
                                    )}
                                </p>
                                <p>
                                    Developed by{" "}
                                    {gameData.developers.join(", ")}, published
                                    by {gameData.publishers.join(", ")}
                                </p>
                                <p>
                                    Has a score of {gameData.review_score} with{" "}
                                    {gameData.review_percentage}% positive Steam
                                    reviews
                                </p>
                            </td>
                        </tr>
                    </table>
                    {gameData.tag_ids.map((tag_id) => (
                        <p key={tag_id}>
                            {unescapeChars(tag_data[tag_id].name)}{" "}
                            {tag_data[tag_id].emoji}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GameScreen;
