import React, { useEffect, useState } from "react";
import tags from "../scripts/scrapedTags.json";

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

function unescapeChars(str: string) {
    return new DOMParser().parseFromString(str, "text/html").documentElement
        .textContent;
}

const GameScreen = () => {
    const [idSearchTerm, setIdSearchTerm] = useState<string>("");
    const [currentGameId, setCurrentGameId] = useState<string>("");
    const [nameSearchTerm, setNameSearchTerm] = useState<string>("");
    const [gameData, setGameData] = useState<GameData | null>(null);
    let tag_data: { [id: string]: TagData } = {};
    tags.forEach(
        (tag) => (tag_data[tag.ID] = { name: tag.name, emoji: tag.emoji })
    );

    useEffect(() => {
        if (currentGameId) {
            search_for_game();
        }
    }, [currentGameId]);

    const search_for_game = () => {
        fetch(`http://127.0.0.1:3001/?game_info=${currentGameId}`).then(
            async (response) => {
                const response_json = await response.json();
                if (response_json.responses[0].success) {
                    const game_data = response_json.responses[0];
                    console.log(game_data);
                    setGameData(game_data);
                }
            }
        );
    };

    const get_game_id = () => {
        fetch(
            `http://127.0.0.1:3001/?game_name_search=${encodeURIComponent(
                nameSearchTerm
            )}`
        ).then(async (response) => {
            const response_json = await response.json();
            if (response_json.responses[0].success) {
                const id_data = response_json.responses[0];
                setIdSearchTerm(id_data.ids[0]);
                setCurrentGameId(id_data.ids[0]);
            }
        });
    };

    return (
        <div className="App">
            <div>
                <input
                    id="game_id_input"
                    onChange={(e) => setNameSearchTerm(e.target.value)}
                />
                <button type="button" onClick={get_game_id}>
                    Fill ID by Name
                </button>
            </div>
            <div>
                <input
                    id="game_id_input"
                    onChange={(e) => setIdSearchTerm(e.target.value)}
                    value={idSearchTerm}
                />
                <button
                    type="button"
                    onClick={() => setCurrentGameId(idSearchTerm)}
                >
                    Search by ID
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
                                            {gameData.steam_release_date != 0
                                                ? `(${new Date(
                                                      gameData.steam_release_date *
                                                          1000
                                                  ).getFullYear()})`
                                                : "(Coming Soon)"}
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
