import React, { useEffect, useState } from "react";
import tags from "../scripts/scrapedTags.json";
import AutocompleteInput from "./AutocompleteInput";
import GameHistoryItem from "./GameHistoryItem";
import GameHistoryConnector from "./GameHistoryConnector";
import GameHistoryLink from "./GameHistoryLink";
import TurnTimer from "./TurnTimer";

export type GameData = {
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

export type TagData = {
    name: string;
    emoji: string;
};

type AutocompleteData = {
    id: string;
    name: string;
    year_text: string;
    review_percentage: number;
};

export enum MatchType {
    None,
    Tags,
    Creators,
    Skip,
}

type MatchData = {
    type: MatchType;
    tag_ids?: number[];
    creators?: string[];
    creator_roles_a?: string[];
    creator_roles_b?: string[];
};

type GameHistoryEntry = {
    id: string;
    data: GameData;
    lifelinesUsed: Lifeline[];
};

export enum Lifeline {
    Skip,
    RevealTags,
    RevealArt,
}

export type GameLinkHistoryEntry = {
    match: MatchData;
    counts: number[];
};

enum Player {
    P1,
    P2,
}

enum GameResult {
    P1Win,
    P2Win,
    Draw,
}

export function unescapeChars(str: string) {
    return new DOMParser().parseFromString(str, "text/html").documentElement.textContent;
}

export function getReleaseYearString(game: GameData) {
    if (!game.has_release_date) {
        return "";
    }
    if (game.steam_release_date == 0) {
        return "(Coming Soon)";
    }
    return `(${getYear(game.steam_release_date)})`;
}

export function getYear(unix: number) {
    return new Date(unix * 1000).getFullYear();
}

const TOP_TAG_LIMIT = 5;

const GameScreen = () => {
    const [usedGameIds, setUsedGameIds] = useState<string[]>(["440"]);
    const [tagUsedCount, setTagUsedCount] = useState<{
        [id: string]: number;
    }>({});
    const [creatorUsedCount, setCreatorUsedCount] = useState<{
        [creator: string]: number;
    }>({});
    const [errorText, setErrorText] = useState<string>("");
    const [newGameId, setNewGameId] = useState<string>("");
    const [nameSearchTerm, setNameSearchTerm] = useState<string>("");
    const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
    const [gameLinkHistory, setGameLinkHistory] = useState<GameLinkHistoryEntry[]>([]);
    const [suggestions, setSuggestions] = useState<AutocompleteData[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<Player>(Player.P1);
    const switchPlayer = () => {
        if (currentPlayer === Player.P1) {
            setCurrentPlayer(Player.P2);
        } else {
            setCurrentPlayer(Player.P1);
        }
    };
    const [lifelinesUsed, setLifelinesUsed] = useState<Map<Player, Lifeline[]>>(
        new Map<Player, Lifeline[]>([
            [Player.P1, []],
            [Player.P2, []],
        ])
    );
    const [gameStarted, setGameStarted] = useState(false);
    const [timerActive, setTimerActive] = useState(false);
    const TIME_LIMIT_MS = 45000;
    const [timerTimeLeft, setTimerTimeLeft] = useState(TIME_LIMIT_MS);
    const [gameIsOver, setGameIsOver] = useState(false);
    const [gameResult, setGameResult] = useState<GameResult | null>(null);
    let tagData: { [id: string]: TagData } = {};
    tags.forEach((tag) => (tagData[tag.ID] = { name: tag.name, emoji: tag.emoji }));

    useEffect(() => {
        const firstGameId = "440";
        if (gameHistory.length > 0) {
            return;
        }
        fetch(`http://127.0.0.1:3001/?game_info=${firstGameId}`).then(async (response) => {
            const response_json = await response.json();
            if (response_json.responses[0].success) {
                const first_game_data = response_json.responses[0];
                setGameHistory([...gameHistory.slice(0, gameHistory.length - 1), { id: firstGameId, data: first_game_data, lifelinesUsed: [] }]);
            }
        });
    }, []);

    useEffect(() => {
        if (nameSearchTerm == "") {
            return;
        }
        fetch(`http://127.0.0.1:3001/?autocomplete_games=${nameSearchTerm}`).then(async (response) => {
            const response_json = await response.json();
            if (response_json.responses[0].success) {
                const autocomplete_data = response_json.responses[0];
                setSuggestions(autocomplete_data.valid_games);
            }
        });
    }, [nameSearchTerm]);

    useEffect(() => {
        if (newGameId != "") {
            searchForGame(newGameId);
        }
    }, [newGameId]);

    const searchForGame = (id: string) => {
        fetch(`http://127.0.0.1:3001/?game_info=${id}`).then(async (response) => {
            const response_json = await response.json();
            if (response_json.responses[0].success) {
                const new_game_data = response_json.responses[0];
                if (usedGameIds.includes(newGameId)) {
                    setErrorText(`${new_game_data.name} has already been played.`);
                    return;
                }
                if (gameHistory[gameHistory.length - 1].data) {
                    const match_result = compare_games(gameHistory[gameHistory.length - 1].data, new_game_data);
                    let new_counts: number[] = [];
                    if (match_result.type == MatchType.Tags) {
                        let new_dict: { [id: string]: number } = {};
                        for (let i = 0; i < (match_result.tag_ids?.length ?? 0); i++) {
                            const new_tag_id = match_result.tag_ids?.[i] ?? 0;
                            if (tagUsedCount[new_tag_id] >= 3) {
                                setErrorText(`${tagData[new_tag_id].name} has already been played 3 times.`);
                                return;
                            }
                            if (new_tag_id in tagUsedCount) {
                                new_dict[new_tag_id] = tagUsedCount[new_tag_id] + 1;
                                new_counts.push(tagUsedCount[new_tag_id] + 1);
                            } else {
                                new_dict[new_tag_id] = 1;
                                new_counts.push(1);
                            }
                        }
                        setTagUsedCount({ ...tagUsedCount, ...new_dict });
                    }
                    if (match_result.type == MatchType.Creators) {
                        let new_dict: { [creator: string]: number } = {};
                        for (let i = 0; i < (match_result.creators?.length ?? 0); i++) {
                            const new_creator_name = match_result.creators?.[i] ?? 0;
                            if (creatorUsedCount[new_creator_name] >= 3) {
                                setErrorText(`${new_creator_name} has already been played 3 times.`);
                                return;
                            }
                            if (new_creator_name in creatorUsedCount) {
                                new_dict[new_creator_name] = creatorUsedCount[new_creator_name] + 1;
                                new_counts.push(creatorUsedCount[new_creator_name] + 1);
                            } else {
                                new_dict[new_creator_name] = 1;
                                new_counts.push(1);
                            }
                        }
                        setCreatorUsedCount({
                            ...creatorUsedCount,
                            ...new_dict,
                        });
                    }
                    if (match_result.type != MatchType.None) {
                        setGameHistory([...gameHistory, { id: newGameId, data: new_game_data, lifelinesUsed: [] }]);
                        setUsedGameIds([...usedGameIds, newGameId]);
                        setGameLinkHistory([...gameLinkHistory, { match: match_result, counts: new_counts }]);
                        setErrorText("");
                        switchPlayer();
                        setTimerTimeLeft(TIME_LIMIT_MS);
                    } else {
                        setErrorText(`No connections to ${new_game_data.name}${new_game_data.year_text ? ` (${new_game_data.year_text})` : ""}.`);
                    }
                    setNewGameId("");
                }
            }
        });
    };

    const compare_games = (game_a: GameData, game_b: GameData): MatchData => {
        const shared_tags = game_a.tag_ids.slice(0, TOP_TAG_LIMIT).filter((tag) => game_b.tag_ids.slice(0, TOP_TAG_LIMIT).includes(tag));
        const shared_creators = [...new Set([...game_a.developers, ...game_a.publishers])].filter((creator) => [...new Set([...game_b.developers, ...game_b.publishers])].includes(creator));
        if (shared_creators.length > 0) {
            const creator_roles = shared_creators.map((creator) => {
                const developed_a = game_a.developers.includes(creator);
                const developed_b = game_b.developers.includes(creator);
                const published_a = game_a.publishers.includes(creator);
                const published_b = game_b.publishers.includes(creator);
                let title_a = "";
                if (developed_a) {
                    if (published_a) {
                        title_a = "Developer & Publisher";
                    } else {
                        title_a = "Developer";
                    }
                } else {
                    title_a = "Publisher";
                }
                let title_b = "";
                if (developed_b) {
                    if (published_b) {
                        title_b = "Developer & Publisher";
                    } else {
                        title_b = "Developer";
                    }
                } else {
                    title_b = "Publisher";
                }
                return {
                    creator,
                    creator_role_a: title_a,
                    creator_role_b: title_b,
                };
            });
            return {
                type: MatchType.Creators,
                creators: creator_roles.map((creator) => creator.creator),
                creator_roles_a: creator_roles.map((creator) => creator.creator_role_a),
                creator_roles_b: creator_roles.map((creator) => creator.creator_role_b),
            };
        }
        if (shared_tags.length > 0) {
            return { type: MatchType.Tags, tag_ids: shared_tags };
        }
        return { type: MatchType.None };
    };

    return (
        <div className="App">
            <h1>Singleplayer Battle Test</h1>
            {!gameStarted && (
                <button
                    onClick={() => {
                        setGameStarted(true);
                        setTimerTimeLeft(TIME_LIMIT_MS);
                        setTimerActive(true);
                    }}
                >
                    Start Game
                </button>
            )}
            {gameStarted && !gameIsOver && (
                <>
                    <p>Current Player: {currentPlayer === Player.P1 ? "Player 1" : "Player 2"}</p>
                    {!lifelinesUsed.get(currentPlayer)?.includes(Lifeline.RevealArt) && (
                        <button
                            type="button"
                            onClick={() => {
                                setTimerTimeLeft(timerTimeLeft + 15000);
                                const tempLifelinesUsed = lifelinesUsed;
                                tempLifelinesUsed.get(currentPlayer)?.push(Lifeline.RevealArt);
                                setLifelinesUsed(tempLifelinesUsed);
                                let currentGame = gameHistory[gameHistory.length - 1];
                                currentGame = { ...currentGame, lifelinesUsed: [...currentGame.lifelinesUsed, Lifeline.RevealArt] };
                                setGameHistory([...gameHistory.slice(0, gameHistory.length - 1), currentGame]);
                            }}
                        >
                            Use Art Lifeline
                        </button>
                    )}
                    {!lifelinesUsed.get(currentPlayer)?.includes(Lifeline.RevealTags) && (
                        <button
                            type="button"
                            onClick={() => {
                                setTimerTimeLeft(timerTimeLeft + 15000);
                                const tempLifelinesUsed = lifelinesUsed;
                                tempLifelinesUsed.get(currentPlayer)?.push(Lifeline.RevealTags);
                                setLifelinesUsed(tempLifelinesUsed);
                                let currentGame = gameHistory[gameHistory.length - 1];
                                currentGame = { ...currentGame, lifelinesUsed: [...currentGame.lifelinesUsed, Lifeline.RevealTags] };
                                setGameHistory([...gameHistory.slice(0, gameHistory.length - 1), currentGame]);
                            }}
                        >
                            Use Tag Lifeline
                        </button>
                    )}
                    {!lifelinesUsed.get(currentPlayer)?.includes(Lifeline.Skip) && (
                        <button
                            type="button"
                            onClick={() => {
                                if (gameLinkHistory.length > 0 && gameLinkHistory[gameLinkHistory.length - 1].match.type === MatchType.Skip) {
                                    setGameIsOver(true);
                                    setGameResult(GameResult.Draw);
                                    setGameHistory([
                                        ...gameHistory.slice(0, gameHistory.length - 1),
                                        {
                                            ...gameHistory[gameHistory.length - 1],
                                            lifelinesUsed: [...new Set([...gameHistory[gameHistory.length - 1].lifelinesUsed, Lifeline.RevealArt, Lifeline.RevealTags])],
                                        },
                                    ]);
                                    return;
                                }
                                const tempLifelinesUsed = lifelinesUsed;
                                tempLifelinesUsed.get(currentPlayer)?.push(Lifeline.Skip);
                                setLifelinesUsed(tempLifelinesUsed);
                                let currentGame = gameHistory[gameHistory.length - 1];
                                currentGame = { ...currentGame, lifelinesUsed: [] };
                                setGameHistory([...gameHistory, currentGame]);
                                setGameLinkHistory([...gameLinkHistory, { match: { type: MatchType.Skip }, counts: [] }]);
                                setErrorText("");
                                switchPlayer();
                                setTimerTimeLeft(TIME_LIMIT_MS);
                            }}
                        >
                            Use Skip Lifeline
                        </button>
                    )}
                    <div>
                        <AutocompleteInput
                            value={nameSearchTerm}
                            setValue={(value) => {
                                setNewGameId(value);
                            }}
                            suggestions={suggestions.map((suggestion) => {
                                return {
                                    label: `${suggestion.name} ${suggestion.year_text != "" ? `(${suggestion.year_text})` : ""}`,
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
                                if (suggestions[0]) {
                                    setNameSearchTerm(suggestions[0].name);
                                    setNewGameId(suggestions[0].id);
                                    searchForGame(suggestions[0].id);
                                }
                            }}
                        >
                            Search by Name
                        </button>
                    </div>
                    <TurnTimer
                        timeLeft={timerTimeLeft}
                        setTimeLeft={setTimerTimeLeft}
                        isCountingDown={timerActive}
                        setIsCountingDown={setTimerActive}
                        onTimerFinished={() => {
                            setGameIsOver(true);
                            setGameResult(currentPlayer === Player.P2 ? GameResult.P1Win : GameResult.P2Win);
                            setGameHistory([
                                ...gameHistory.slice(0, gameHistory.length - 1),
                                {
                                    ...gameHistory[gameHistory.length - 1],
                                    lifelinesUsed: [...new Set([...gameHistory[gameHistory.length - 1].lifelinesUsed, Lifeline.RevealArt, Lifeline.RevealTags])],
                                },
                            ]);
                        }}
                    />
                </>
            )}
            {gameIsOver && (
                <>
                    <h2>Game Over.</h2>
                    {gameResult === GameResult.P1Win && <h3>Player 1 wins!</h3>}
                    {gameResult === GameResult.P2Win && <h3>Player 2 wins!</h3>}
                    {gameResult === GameResult.Draw && <h3>Draw!</h3>}
                </>
            )}
            <div style={{ height: "50px" }} />
            {!gameIsOver && errorText != "" && <p style={{ color: "#f33" }}>{errorText}</p>}
            {gameHistory[0]?.data && (
                <div>
                    {gameHistory
                        .slice(0)
                        .reverse()
                        .map((game, index) => {
                            const gameLinkHistoryEntry = gameLinkHistory[gameLinkHistory.length - index - 1];
                            return (
                                <div key={`${game.id}-${index}`}>
                                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                        <GameHistoryItem id={game.id} data={game.data} tagData={tagData} lifelinesUsed={game.lifelinesUsed} viewDetailsButtonVisible={gameIsOver} />
                                        <div style={{ width: "35vw" }} />
                                    </div>
                                    {index !== gameHistory.length - 1 && (
                                        <>
                                            <GameHistoryConnector />
                                            <GameHistoryLink gameLinkHistoryEntry={gameLinkHistoryEntry} tagData={tagData} />
                                            <GameHistoryConnector />
                                        </>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
};

export default GameScreen;
