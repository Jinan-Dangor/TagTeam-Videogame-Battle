import React, { useEffect, useState } from "react";
import tags from "../scripts/scrapedTags.json";
import AutocompleteInput from "./AutocompleteInput";
import GameHistoryItem from "./GameHistoryItem";
import GameHistoryConnector from "./GameHistoryConnector";
import GameHistoryLink from "./GameHistoryLink";
import TurnTimer from "./TurnTimer";
import LifelineButtons from "./LifelineButtons";
import { initializePalette } from "../utilities/ColourPalette";

export type GameData = {
    name: string;
    developers: string[];
    publishers: string[];
    tag_ids: string[];
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

type GameNameAutocompleteData = {
    id: string;
    name: string;
    year_text: string;
    review_percentage: number;
};

type TagAutocompleteData = {
    id: string;
    name: string;
};

export enum MatchType {
    None,
    Tags,
    Creators,
    Skip,
}

type MatchData = {
    type: MatchType;
    tag_ids?: string[];
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

export enum Player {
    P1,
    P2,
}

enum GameResult {
    P1Win,
    P2Win,
    Draw,
}

enum SettingMatchSystem {
    TopFiveTags,
    CalledTags,
}

export function unescapeChars(str: string) {
    return new DOMParser().parseFromString(str, "text/html").documentElement.textContent;
}

export function getReleaseYearString(game: GameData) {
    if (!game.has_release_date) {
        return "";
    }
    if (game.steam_release_date === 0) {
        return "(Coming Soon)";
    }
    return `(${getYear(game.steam_release_date)})`;
}

export function getYear(unix: number) {
    return new Date(unix * 1000).getFullYear();
}

function simplifySearchTerm(searchTerm: string) {
    return searchTerm.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TOP_TAG_LIMIT = 5;
initializePalette();

const GameScreen = () => {
    const [settingMatchSystem, setSettingMatchSystem] = useState(SettingMatchSystem.CalledTags);
    const [usedGameIds, setUsedGameIds] = useState(["440"]);
    const [tagUsedCount, setTagUsedCount] = useState<{
        [id: string]: number;
    }>({});
    const [creatorUsedCount, setCreatorUsedCount] = useState<{
        [creator: string]: number;
    }>({});
    const [errorText, setErrorText] = useState("");
    const [newGameId, setNewGameId] = useState("");
    const [nameSearchTerm, setNameSearchTerm] = useState("");
    const [tagSearchTerm, setTagSearchTerm] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [tagSuggestions, setTagSuggestions] = useState<TagAutocompleteData[]>([]);
    const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
    const [gameLinkHistory, setGameLinkHistory] = useState<GameLinkHistoryEntry[]>([]);
    const [gameNameSuggestions, setGameNameSuggestions] = useState<GameNameAutocompleteData[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState(Player.P1);
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
    const [timeLimit, setTimeLimit] = useState(60000);
    const [lifelineTimeBonus, setLifelineTimeBonus] = useState(20000);
    const [timerTimeLeft, setTimerTimeLeft] = useState(timeLimit);
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
        if (nameSearchTerm === "") {
            return;
        }
        fetch(`http://127.0.0.1:3001/?autocomplete_games=${encodeURIComponent(nameSearchTerm)}`).then(async (response) => {
            const response_json = await response.json();
            if (response_json.responses[0].success) {
                const autocomplete_data = response_json.responses[0];
                setGameNameSuggestions(autocomplete_data.valid_games);
            }
        });
    }, [nameSearchTerm]);

    useEffect(() => {
        if (tagSearchTerm === "") {
            return;
        }
        const simplifiedSearchTerm = simplifySearchTerm(tagSearchTerm);
        const matchingTags = Object.keys(tagData)
            .filter((id) => simplifySearchTerm(tagData[id].name).includes(simplifiedSearchTerm))
            .map((id) => {
                return {
                    id,
                    name: tagData[id].name,
                };
            })
            .sort((a, b) => {
                const simple_name_a = simplifySearchTerm(a.name);
                const simple_name_b = simplifySearchTerm(b.name);
                const starting_mod_a = simple_name_a.startsWith(simplifiedSearchTerm) ? 1000 : 0;
                const perfect_mod_a = simple_name_a === simplifiedSearchTerm ? 10000 : 0;
                const starting_mod_b = simple_name_b.startsWith(simplifiedSearchTerm) ? 1000 : 0;
                const perfect_mod_b = simple_name_b === simplifiedSearchTerm ? 10000 : 0;
                const final_score_a = starting_mod_a + perfect_mod_a;
                const final_score_b = starting_mod_b + perfect_mod_b;
                return final_score_b - final_score_a;
            })
            .slice(0, 10);
        setTagSuggestions(matchingTags);
    }, [tagSearchTerm]);

    useEffect(() => {
        if (newGameId !== "") {
            searchForGame(newGameId);
        }
    }, [newGameId, selectedTag]);

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
                    let matchResult;
                    if (settingMatchSystem === SettingMatchSystem.TopFiveTags) {
                        console.log(`Comparing as if top 5`);
                        matchResult = compareGameTopTags(gameHistory[gameHistory.length - 1].data, new_game_data);
                    } else if (settingMatchSystem === SettingMatchSystem.CalledTags) {
                        console.log(`Comparing with called tag`);
                        matchResult = compareGameCalledTag(gameHistory[gameHistory.length - 1].data, new_game_data, selectedTag);
                    } else {
                        console.error("Setting 'Match System' not set to known value.");
                        return;
                    }
                    let newCounts: number[] = [];
                    if (matchResult.type === MatchType.Tags) {
                        let new_dict: { [id: string]: number } = {};
                        for (let i = 0; i < (matchResult.tag_ids?.length ?? 0); i++) {
                            const new_tag_id = matchResult.tag_ids?.[i] ?? 0;
                            if (tagUsedCount[new_tag_id] >= 3) {
                                setErrorText(`${tagData[new_tag_id].name} has already been played 3 times.`);
                                return;
                            }
                            if (new_tag_id in tagUsedCount) {
                                new_dict[new_tag_id] = tagUsedCount[new_tag_id] + 1;
                                newCounts.push(tagUsedCount[new_tag_id] + 1);
                            } else {
                                new_dict[new_tag_id] = 1;
                                newCounts.push(1);
                            }
                        }
                        setTagUsedCount({ ...tagUsedCount, ...new_dict });
                    }
                    if (matchResult.type === MatchType.Creators) {
                        let new_dict: { [creator: string]: number } = {};
                        for (let i = 0; i < (matchResult.creators?.length ?? 0); i++) {
                            const new_creator_name = matchResult.creators?.[i] ?? 0;
                            if (creatorUsedCount[new_creator_name] >= 3) {
                                setErrorText(`${new_creator_name} has already been played 3 times.`);
                                return;
                            }
                            if (new_creator_name in creatorUsedCount) {
                                new_dict[new_creator_name] = creatorUsedCount[new_creator_name] + 1;
                                newCounts.push(creatorUsedCount[new_creator_name] + 1);
                            } else {
                                new_dict[new_creator_name] = 1;
                                newCounts.push(1);
                            }
                        }
                        setCreatorUsedCount({
                            ...creatorUsedCount,
                            ...new_dict,
                        });
                    }
                    if (matchResult.type !== MatchType.None) {
                        setGameHistory([...gameHistory, { id: newGameId, data: new_game_data, lifelinesUsed: [] }]);
                        setUsedGameIds([...usedGameIds, newGameId]);
                        setGameLinkHistory([...gameLinkHistory, { match: matchResult, counts: newCounts }]);
                        setErrorText("");
                        switchPlayer();
                        setTimerTimeLeft(timeLimit);
                        setNameSearchTerm("");
                        setNewGameId("");
                    } else {
                        setErrorText(`No connections to ${new_game_data.name}${new_game_data.year_text ? ` (${new_game_data.year_text})` : ""}.`);
                    }
                }
            }
        });
    };

    const compareGames = (gameA: GameData, gameB: GameData): MatchData => {
        const shared_tags = gameA.tag_ids.filter((tag) => gameB.tag_ids.includes(tag));
        const shared_creators = [...new Set([...gameA.developers, ...gameA.publishers])].filter((creator) => [...new Set([...gameB.developers, ...gameB.publishers])].includes(creator));
        if (shared_creators.length > 0) {
            const creator_roles = shared_creators.map((creator) => {
                const developed_a = gameA.developers.includes(creator);
                const developed_b = gameB.developers.includes(creator);
                const published_a = gameA.publishers.includes(creator);
                const published_b = gameB.publishers.includes(creator);
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

    const compareGameTopTags = (gameA: GameData, gameB: GameData): MatchData => {
        const match = compareGames(gameA, gameB);
        const sharedTags = gameA.tag_ids.slice(0, TOP_TAG_LIMIT).filter((tag) => gameB.tag_ids.slice(0, TOP_TAG_LIMIT).includes(tag));
        if (match.type === MatchType.Tags) {
            const hasValidTagMatches = sharedTags.filter((tag) => match.tag_ids?.includes(tag)).length > 0;
            if (hasValidTagMatches) {
                match.tag_ids = sharedTags;
                return match;
            }
            const noMatch = { type: MatchType.None };
            return noMatch;
        }
        return match;
    };

    const compareGameCalledTag = (gameA: GameData, gameB: GameData, calledTag: string | null): MatchData => {
        const match = compareGames(gameA, gameB);
        if (match.type === MatchType.Tags) {
            if (calledTag === null) {
                const noMatch = { type: MatchType.None };
                return noMatch;
            }
            if (match.tag_ids?.includes(calledTag)) {
                match.tag_ids = [calledTag];
                return match;
            }
            const noMatch = { type: MatchType.None };
            return noMatch;
        }
        return match;
    };

    const LifelineButtonsTemplate = (
        <LifelineButtons
            lifelinesUsed={lifelinesUsed}
            currentPlayer={currentPlayer}
            onClickRevealArt={() => {
                setTimerTimeLeft(timerTimeLeft + lifelineTimeBonus);
                const tempLifelinesUsed = lifelinesUsed;
                tempLifelinesUsed.get(currentPlayer)?.push(Lifeline.RevealArt);
                setLifelinesUsed(tempLifelinesUsed);
                let currentGame = gameHistory[gameHistory.length - 1];
                currentGame = { ...currentGame, lifelinesUsed: [...currentGame.lifelinesUsed, Lifeline.RevealArt] };
                setGameHistory([...gameHistory.slice(0, gameHistory.length - 1), currentGame]);
            }}
            onClickRevealTags={() => {
                setTimerTimeLeft(timerTimeLeft + lifelineTimeBonus);
                const tempLifelinesUsed = lifelinesUsed;
                tempLifelinesUsed.get(currentPlayer)?.push(Lifeline.RevealTags);
                setLifelinesUsed(tempLifelinesUsed);
                let currentGame = gameHistory[gameHistory.length - 1];
                currentGame = { ...currentGame, lifelinesUsed: [...currentGame.lifelinesUsed, Lifeline.RevealTags] };
                setGameHistory([...gameHistory.slice(0, gameHistory.length - 1), currentGame]);
            }}
            onClickSkip={() => {
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
                setTimerTimeLeft(timeLimit);
            }}
        />
    );

    return (
        <div className="App">
            <h1 style={{ marginTop: "0" }}>Singleplayer Battle Test</h1>
            {!gameStarted && (
                <>
                    <button
                        style={{ fontSize: "large" }}
                        onClick={() => {
                            setGameStarted(true);
                            setTimerTimeLeft(timeLimit);
                            setTimerActive(true);
                        }}
                    >
                        Start Game
                    </button>
                    <h2>Settings</h2>
                    <input
                        type="checkbox"
                        name="Match Settings"
                        id="Called Tags"
                        onClick={(e) => {
                            setSettingMatchSystem(SettingMatchSystem.CalledTags);
                        }}
                        checked={settingMatchSystem === SettingMatchSystem.CalledTags}
                    />
                    <label htmlFor="Called Tags">Manually choose a tag to match on</label>
                    <br />
                    <input
                        type="checkbox"
                        name="Match Settings"
                        id="Top 5 Tags"
                        onClick={(e) => {
                            setSettingMatchSystem(SettingMatchSystem.TopFiveTags);
                        }}
                        checked={settingMatchSystem === SettingMatchSystem.TopFiveTags}
                    />
                    <label htmlFor="Top 5 Tags">Match automatically on Top 5 tags</label>
                </>
            )}
            {gameStarted && !gameIsOver && (
                <>
                    <div style={{ display: "flex" }}>
                        <div style={{ width: "40vw" }}>{currentPlayer === Player.P1 && LifelineButtonsTemplate}</div>
                        <div style={{ width: "30vw" }}>
                            <p>Current Player: {currentPlayer === Player.P1 ? "Player 1" : "Player 2"}</p>
                            <div style={{ marginBottom: "5px" }}>
                                <AutocompleteInput
                                    value={nameSearchTerm}
                                    setValue={(value) => {
                                        setNewGameId(value);
                                    }}
                                    suggestions={gameNameSuggestions.map((suggestion) => {
                                        return {
                                            label: `${suggestion.name} ${suggestion.year_text !== "" ? `(${suggestion.year_text})` : ""}`,
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
                                    style={{ width: "125px", padding: "2px", marginLeft: "10px", fontSize: "large" }}
                                    onClick={() => {
                                        if (gameNameSuggestions[0]) {
                                            setNameSearchTerm(gameNameSuggestions[0].name);
                                            setNewGameId(gameNameSuggestions[0].id);
                                        }
                                    }}
                                >
                                    Search by Name
                                </button>
                            </div>
                            {settingMatchSystem === SettingMatchSystem.CalledTags && (
                                <div>
                                    <AutocompleteInput
                                        placeholder="Won't match on tags if blank"
                                        value={tagSearchTerm}
                                        setValue={(value) => {
                                            setSelectedTag(value);
                                        }}
                                        suggestions={tagSuggestions.map((suggestion) => {
                                            return {
                                                label: `${suggestion.name}`,
                                                search_term: suggestion.name,
                                                value: suggestion.id,
                                            };
                                        })}
                                        onChange={(e) => {
                                            setTagSearchTerm(e.target.value);
                                            if (e.target.value === "") {
                                                setSelectedTag(null);
                                            }
                                        }}
                                        onSelectSuggestion={(value) => {
                                            setTagSearchTerm(value);
                                        }}
                                    />
                                    <button
                                        type="button"
                                        style={{ width: "125px", padding: "2px", marginLeft: "10px", fontSize: "large" }}
                                        onClick={() => {
                                            if (tagSuggestions[0]) {
                                                setTagSearchTerm(tagSuggestions[0].name);
                                                setSelectedTag(tagSuggestions[0].id);
                                                if (gameNameSuggestions[0]) {
                                                    setNameSearchTerm(gameNameSuggestions[0].name);
                                                    setNewGameId(gameNameSuggestions[0].id);
                                                }
                                            }
                                        }}
                                    >
                                        Check This Tag
                                    </button>
                                </div>
                            )}
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
                        </div>

                        <div style={{ width: "40vw" }}>{currentPlayer === Player.P2 && LifelineButtonsTemplate}</div>
                    </div>
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
            {!gameIsOver && errorText !== "" && <p style={{ color: "#f33" }}>{errorText}</p>}
            {gameStarted && gameHistory[0]?.data && (
                <div style={{ paddingBottom: "100px" }}>
                    {gameHistory
                        .slice(0)
                        .reverse()
                        .map((game, index) => {
                            const gameNumber = gameLinkHistory.length - index + 1;
                            const gameLinkHistoryEntry = gameLinkHistory[gameNumber - 2];
                            const gamePlayer = (gameLinkHistory.length - index - 1) % 2 === 0 ? Player.P2 : Player.P1;
                            return (
                                <div key={`${game.id}-${gameLinkHistory.length - index - 1}`}>
                                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                        <GameHistoryItem
                                            id={game.id}
                                            gameNumber={gameNumber}
                                            data={game.data}
                                            tagData={tagData}
                                            lifelinesUsed={game.lifelinesUsed}
                                            viewDetailsButtonVisible={gameIsOver}
                                            player={gamePlayer}
                                        />
                                        <div style={{ width: "33.25vw" }} />
                                    </div>
                                    {index !== gameHistory.length - 1 && (
                                        <>
                                            <GameHistoryConnector player={gamePlayer} />
                                            <GameHistoryLink gameLinkHistoryEntry={gameLinkHistoryEntry} tagData={tagData} />
                                            <GameHistoryConnector player={gamePlayer} />
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
