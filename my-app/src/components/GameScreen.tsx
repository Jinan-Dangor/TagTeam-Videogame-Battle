import React, { useEffect, useMemo, useRef, useState } from "react";
import tags from "../scripts/scrapedTags.json";
import AutocompleteInput from "./AutocompleteInput";
import GameHistoryItem from "./GameHistoryItem";
import GameHistoryConnector from "./GameHistoryConnector";
import GameHistoryLink from "./GameHistoryLink";
import TurnTimer, { TimerContext } from "./TurnTimer";
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

const StrToMatchType = (s: string): MatchType => {
    switch (s) {
        case "None":
            return MatchType.None;
        case "Tags":
            return MatchType.Tags;
        case "Creators":
            return MatchType.Creators;
        case "Skip":
            return MatchType.Skip;
        default:
            console.error(`Attempting to convert invalid string ${s} into a MatchType enum.`);
            return MatchType.None;
    }
};

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

const StrToLifeline = (s: string): Lifeline => {
    switch (s) {
        case "Skip":
            return Lifeline.Skip;
        case "RevealTags":
            return Lifeline.RevealTags;
        case "RevealArt":
            return Lifeline.RevealArt;
        default:
            console.error(`Attempting to convert invalid string ${s} into a Lifeline enum.`);
            return Lifeline.Skip;
    }
};

export type GameLinkHistoryEntry = {
    match: MatchData;
    counts: number[];
};

export enum Player {
    P1,
    P2,
}

const StrToPlayer = (s: string): Player => {
    switch (s) {
        case "P1":
            return Player.P1;
        case "P2":
            return Player.P2;
        default:
            console.error(`Attempting to convert invalid string ${s} into a Player enum.`);
            return Player.P1;
    }
};

enum GameResult {
    P1Win,
    P2Win,
    Draw,
}

const StrToGameResult = (s: string): GameResult => {
    switch (s) {
        case "P1Win":
            return GameResult.P1Win;
        case "P2Win":
            return GameResult.P2Win;
        case "Draw":
            return GameResult.Draw;
        default:
            console.error(`Attempting to convert invalid string ${s} into a GameResult enum.`);
            return GameResult.Draw;
    }
};

enum SettingMatchSystem {
    TopFiveTags,
    CalledTags,
}

const StrToSettingMatchSystem = (s: string) => {
    switch (s) {
        case "TopFiveTags":
            return SettingMatchSystem.TopFiveTags;
        case "CalledTags":
            return SettingMatchSystem.CalledTags;
        default:
            console.error(`Attempting to convert invalid string ${s} into a SettingMatchSystem enum.`);
            return SettingMatchSystem.CalledTags;
    }
};

const SettingMatchSystemToStr = (m: SettingMatchSystem) => {
    switch (m) {
        case SettingMatchSystem.TopFiveTags:
            return "TopFiveTags";
        case SettingMatchSystem.CalledTags:
            return "CalledTags";
        default:
            console.error(`Attempting to convert invalid SettingMatchSystem enum ${m} into a string.`);
            return SettingMatchSystem.CalledTags;
    }
};

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

initializePalette();

const GameScreen = () => {
    const serverSocket = useRef<WebSocket>();
    const outgoingApiCalls = useRef<string[]>([]);
    const latestGameAutocompleteId = useRef<string>();
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [duelKey, setDuelKey] = useState<string | null>(null);
    const [settingMatchSystem, setSettingMatchSystem] = useState(SettingMatchSystem.CalledTags);
    const settingMatchSystemRef = useRef(settingMatchSystem);
    useEffect(() => {
        settingMatchSystemRef.current = settingMatchSystem;
    }, [settingMatchSystem]);
    const [gameConnectedTo, setGameConnectedTo] = useState(false);
    const [otherPlayerConnected, setOtherPlayerConnected] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [gameIsOver, setGameIsOver] = useState(false);
    const [gameResult, setGameResult] = useState<GameResult | null>(null);
    const [usedGameIds, setUsedGameIds] = useState<string[]>([]);
    const usedGameIdsRef = useRef(usedGameIds);
    useEffect(() => {
        usedGameIdsRef.current = usedGameIds;
    }, [usedGameIds]);
    const [tagUsedCount, setTagUsedCount] = useState<{
        [id: string]: number;
    }>({});
    const tagUsedCountRef = useRef(tagUsedCount);
    useEffect(() => {
        tagUsedCountRef.current = tagUsedCount;
    }, [tagUsedCount]);
    const [creatorUsedCount, setCreatorUsedCount] = useState<{
        [creator: string]: number;
    }>({});
    const creatorUsedCountRef = useRef(creatorUsedCount);
    useEffect(() => {
        creatorUsedCountRef.current = creatorUsedCount;
    }, [creatorUsedCount]);
    const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
    const gameHistoryRef = useRef(gameHistory);
    useEffect(() => {
        gameHistoryRef.current = gameHistory;
    }, [gameHistory]);
    const [gameLinkHistory, setGameLinkHistory] = useState<GameLinkHistoryEntry[]>([]);
    const gameLinkHistoryRef = useRef(gameLinkHistory);
    useEffect(() => {
        gameLinkHistoryRef.current = gameLinkHistory;
    }, [gameLinkHistory]);
    const [currentPlayer, setCurrentPlayer] = useState(Player.P1);
    const currentPlayerRef = useRef(currentPlayer);
    useEffect(() => {
        currentPlayerRef.current = currentPlayer;
    }, [currentPlayer]);
    const [localPlayer, setLocalPlayer] = useState(Player.P1);
    const [lifelinesUsed, setLifelinesUsed] = useState<Map<Player, Lifeline[]>>(
        new Map<Player, Lifeline[]>([
            [Player.P1, []],
            [Player.P2, []],
        ]),
    );
    const lifelinesUsedRef = useRef(lifelinesUsed);
    useEffect(() => {
        lifelinesUsedRef.current = lifelinesUsed;
    }, [lifelinesUsed]);
    const [errorText, setErrorText] = useState("");
    const [newGameId, setNewGameId] = useState("");
    const [nameSearchTerm, setNameSearchTerm] = useState("");
    const [tagSearchTerm, setTagSearchTerm] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const selectedTagRef = useRef(selectedTag);
    useEffect(() => {
        selectedTagRef.current = selectedTag;
    }, [selectedTag]);
    const [tagSuggestions, setTagSuggestions] = useState<TagAutocompleteData[]>([]);
    const [gameNameSuggestions, setGameNameSuggestions] = useState<GameNameAutocompleteData[]>([]);
    const switchPlayer = () => {
        if (currentPlayerRef.current === Player.P1) {
            setCurrentPlayer(Player.P2);
        } else {
            setCurrentPlayer(Player.P1);
        }
    };
    const [timerActive, setTimerActive] = useState(false);
    const timeLimit = useRef(60000);
    const [lifelineTimeBonus, setLifelineTimeBonus] = useState(20000);
    const [timerTimeLeft, setTimerTimeLeft] = useState(timeLimit.current);
    let tagData: { [id: string]: TagData } = {};
    tags.forEach((tag) => (tagData[tag.ID] = { name: tag.name, emoji: tag.emoji }));

    const generateApiKey = () => {
        const possibleChars = "0123456789qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM";
        let key = "key_";
        let format = "............";
        for (let i = 0; i < format.length; i++) {
            if (format[i] === ".") {
                key += possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
            } else {
                key += format[i];
            }
        }
        if (outgoingApiCalls.current.includes(key)) {
            key = generateApiKey();
        }
        return key;
    };

    const sendApiMessage = (queryType: string, payload: any) => {
        const queryId = generateApiKey();
        outgoingApiCalls.current.push(queryId);
        serverSocket.current?.send(JSON.stringify({ queryType, queryId, ...payload }));
        return queryId;
    };

    useEffect(() => {
        // Local: "ws://localhost:8080"
        // Local network: "ws://192.168.0.65:8080"
        serverSocket.current = new WebSocket("ws://157.211.249.178:8080");

        const newSocket = serverSocket.current;

        serverSocket.current.onopen = (event) => {
            console.log(`Client connected to web socket server successfully!`);
            sendApiMessage("gen_player_id", {});
        };

        serverSocket.current.onmessage = (event) => {
            let apiMessage: any = undefined;
            try {
                apiMessage = JSON.parse(event.data);
            } catch {
                console.error(`Non-JSON server response detected: ${event.data}`);
                return;
            }
            if (!apiMessage.queryType) {
                console.error(`API call does not have a queryType:`);
                console.error(apiMessage);
                return;
            }
            const queryType = apiMessage.queryType;
            const queryId = apiMessage.queryId;
            if (outgoingApiCalls.current.includes(apiMessage.queryId)) {
                outgoingApiCalls.current.splice(outgoingApiCalls.current.indexOf(queryId), 1);
            }
            if (!apiMessage.success) {
                console.error(`API call failed:`);
                console.error(apiMessage);
                return;
            }
            if (queryType === "echo") {
            } else if (queryType === "gen_player_id") {
                if (!apiMessage.key) {
                    console.error(`newPlayerKey absent in gen_player_id request response.`);
                    return;
                }
                setPlayerId(apiMessage.key);
            } else if (queryType === "make_guess") {
                if (apiMessage.errorText) {
                    setErrorText(apiMessage.errorText);
                    return;
                }
                if (!apiMessage.guessData) {
                    console.error(`guessData absent in game_info request response.`);
                    return;
                }
                const newGuessData = apiMessage.guessData;
                const guessedGameId = newGuessData.gameId;
                const guessMatchResult = newGuessData.matchResult;
                guessMatchResult.type = StrToMatchType(guessMatchResult.type);
                const guessMatchType = guessMatchResult.type;
                const guessGameData = newGuessData.gameData;
                const guessNewCounts = newGuessData.newCounts;
                if (gameHistoryRef.current[gameHistoryRef.current.length - 1].data) {
                    if (guessMatchType === MatchType.Tags) {
                        const guessNewDict: { [id: string]: number } = newGuessData.newDict;
                        setTagUsedCount({ ...tagUsedCountRef.current, ...guessNewDict });
                    }
                    if (guessMatchType === MatchType.Creators) {
                        const guessNewDict: { [creator: string]: number } = newGuessData.newDict;
                        setCreatorUsedCount({
                            ...creatorUsedCountRef.current,
                            ...guessNewDict,
                        });
                    }
                    if (guessMatchType !== MatchType.None) {
                        setGameHistory([...gameHistoryRef.current, { id: guessedGameId, data: guessGameData, lifelinesUsed: [] }]);
                        setUsedGameIds([...usedGameIdsRef.current, guessedGameId]);
                        setGameLinkHistory([...gameLinkHistoryRef.current, { match: guessMatchResult, counts: guessNewCounts }]);
                        setErrorText("");
                        switchPlayer();
                        setTimerTimeLeft(timeLimit.current);
                        setNameSearchTerm("");
                        setNewGameId("");
                    } else {
                        setErrorText(`No connections to ${guessGameData.name}${guessGameData.year_text ? ` (${guessGameData.year_text})` : ""}.`);
                    }
                }
            } else if (queryType === "autocomplete_games") {
                if (!apiMessage.searchResults) {
                    console.error(`autocomplete_games not supplied with searchResults.`);
                    return;
                }
                if (queryId === latestGameAutocompleteId.current) {
                    setGameNameSuggestions(apiMessage.searchResults);
                }
            } else if (queryType === "player_joined") {
                setOtherPlayerConnected(true);
            } else if (queryType === "player_disconnected") {
                setOtherPlayerConnected(false);
            } else if (queryType === "host_game") {
                if (apiMessage.success && apiMessage.newDuelKey) {
                    console.log(`Game hosted successfully! Duel Key: ${apiMessage.newDuelKey}`);
                } else {
                    console.error(`Game failed to host`);
                }
                setDuelKey(apiMessage.newDuelKey);
                setGameConnectedTo(true);
            } else if (queryType === "start_game") {
                sendApiMessage("get_duel_state", { duelKey: apiMessage.duelKey });
                setGameStarted(true);
                setTimerTimeLeft(timeLimit.current);
                setTimerActive(true);
            } else if (queryType === "join_game") {
                if (apiMessage.success && apiMessage.duelKey) {
                    console.log(`Game joined successfully! Duel Key: ${apiMessage.duelKey}`);
                } else {
                    console.error(`Failed to join game`);
                    return;
                }
                setLocalPlayer(Player.P2);
                setDuelKey(apiMessage.duelKey);
                setGameConnectedTo(true);
                setOtherPlayerConnected(true);
            } else if (queryType === "turn_started") {
            } else if (queryType === "use_lifeline") {
                if (!apiMessage.lifelineUsed) {
                    console.error(`A lifeline was used, but the server didn't specify which.`);
                    return;
                }
                const lifelineUsed = apiMessage.lifelineUsed;
                if (lifelineUsed == "revealArt") {
                    onClickLifelineRevealArt();
                } else if (lifelineUsed == "revealTags") {
                    onClickLifelineRevealTags();
                } else if (lifelineUsed == "skip") {
                    onClickLifelineSkip();
                } else {
                    console.error(`A lifeline was used, but the provided lifeline type doesn't exist: ${lifelineUsed}`);
                }
            } else if (queryType === "get_duel_state") {
                const necessaryFields = [
                    "settings",
                    "gameStarted",
                    "gameIsOver",
                    "usedGameIds",
                    "tagUsedCount",
                    "creatorUsedCount",
                    "gameHistory",
                    "gameLinkHistory",
                    "currentPlayer",
                    "lifelinesUsed",
                ];
                for (let i = 0; i < necessaryFields.length; i++) {
                    if (apiMessage[necessaryFields[i]] === null) {
                        console.error(`Following API call is missing field ${necessaryFields[i]}:`);
                        console.error(apiMessage);
                        return;
                    }
                }
                setSettingMatchSystem(StrToSettingMatchSystem(apiMessage.settings.matchSystem));
                setGameStarted(apiMessage.gameStarted);
                setGameIsOver(apiMessage.gameIsOver);
                if (apiMessage.gameResult) {
                    setGameResult(StrToGameResult(apiMessage.gameResult));
                }
                setUsedGameIds(apiMessage.usedGameIds);
                setTagUsedCount(apiMessage.tagUsedCount);
                setCreatorUsedCount(apiMessage.creatorUsedCount);
                setGameHistory(apiMessage.gameHistory);
                setGameLinkHistory(apiMessage.gameLinkHistory);
                const lifelinesUsedConverted = apiMessage.lifelinesUsed.map((lifelineEntry: any) => [StrToPlayer(lifelineEntry[0]), lifelineEntry[1].map((lifeline: any) => StrToLifeline(lifeline))]);
                setLifelinesUsed(new Map<Player, Lifeline[]>(lifelinesUsedConverted));
            } else {
                console.error(`API call doesn't correspond to a known queryType: ${apiMessage.toString()}`);
            }
        };

        return () => newSocket.close();
    }, []);

    useEffect(() => {
        if (nameSearchTerm === "") {
            setGameNameSuggestions([]);
            latestGameAutocompleteId.current = undefined;
            return;
        }
        latestGameAutocompleteId.current = sendApiMessage("autocomplete_games", { searchTerm: encodeURIComponent(nameSearchTerm) });
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
            if (usedGameIds.includes(newGameId)) {
                setErrorText(`${tagSearchTerm} has already been played.`);
                return;
            }
            sendApiMessage("make_guess", { duelKey, playerId, gameId: newGameId, selectedTag: selectedTag });
        }
    }, [newGameId, selectedTag]);

    function onClickLifelineRevealArt(): void {
        setTimerTimeLeft(timerTimeLeft + lifelineTimeBonus);
        const tempLifelinesUsed = lifelinesUsedRef.current;
        tempLifelinesUsed.get(currentPlayerRef.current)?.push(Lifeline.RevealArt);
        setLifelinesUsed(tempLifelinesUsed);
        let currentGame = gameHistoryRef.current[gameHistoryRef.current.length - 1];
        currentGame = { ...currentGame, lifelinesUsed: [...currentGame.lifelinesUsed, Lifeline.RevealArt] };
        setGameHistory([...gameHistoryRef.current.slice(0, gameHistoryRef.current.length - 1), currentGame]);
    }

    function onClickLifelineRevealTags(): void {
        setTimerTimeLeft(timerTimeLeft + lifelineTimeBonus);
        const tempLifelinesUsed = lifelinesUsedRef.current;
        tempLifelinesUsed.get(currentPlayerRef.current)?.push(Lifeline.RevealTags);
        setLifelinesUsed(tempLifelinesUsed);
        let currentGame = gameHistoryRef.current[gameHistoryRef.current.length - 1];
        currentGame = { ...currentGame, lifelinesUsed: [...currentGame.lifelinesUsed, Lifeline.RevealTags] };
        setGameHistory([...gameHistoryRef.current.slice(0, gameHistoryRef.current.length - 1), currentGame]);
    }

    function onClickLifelineSkip(): void {
        if (gameLinkHistoryRef.current.length > 0 && gameLinkHistoryRef.current[gameLinkHistoryRef.current.length - 1].match.type === MatchType.Skip) {
            setGameIsOver(true);
            setGameResult(GameResult.Draw);
            setGameHistory([
                ...gameHistoryRef.current.slice(0, gameHistoryRef.current.length - 1),
                {
                    ...gameHistoryRef.current[gameHistoryRef.current.length - 1],
                    lifelinesUsed: [...new Set([...gameHistoryRef.current[gameHistoryRef.current.length - 1].lifelinesUsed, Lifeline.RevealArt, Lifeline.RevealTags])],
                },
            ]);
            return;
        }
        const tempLifelinesUsed = lifelinesUsedRef.current;
        tempLifelinesUsed.get(currentPlayerRef.current)?.push(Lifeline.Skip);
        setLifelinesUsed(tempLifelinesUsed);
        let currentGame = gameHistoryRef.current[gameHistoryRef.current.length - 1];
        currentGame = { ...currentGame, lifelinesUsed: [] };
        setGameHistory([...gameHistoryRef.current, currentGame]);
        setGameLinkHistory([...gameLinkHistoryRef.current, { match: { type: MatchType.Skip }, counts: [] }]);
        setErrorText("");
        switchPlayer();
        setTimerTimeLeft(timeLimit.current);
    }

    const LifelineButtonsTemplate = (
        <LifelineButtons
            lifelinesUsed={lifelinesUsed}
            currentPlayer={currentPlayer}
            onClickRevealArt={() => {
                onClickLifelineRevealArt();
                sendApiMessage("use_lifeline", { duelKey, playerId, lifelineUsed: "revealArt" });
            }}
            onClickRevealTags={() => {
                onClickLifelineRevealTags();
                sendApiMessage("use_lifeline", { duelKey, playerId, lifelineUsed: "revealTags" });
            }}
            onClickSkip={() => {
                onClickLifelineSkip();
                sendApiMessage("use_lifeline", { duelKey, playerId, lifelineUsed: "skip" });
            }}
        />
    );

    return (
        <div className="App">
            <h1 style={{ marginTop: "0" }}>Multiplayer Steam Chain Test</h1>
            {!gameStarted && !gameConnectedTo && (
                <>
                    <button
                        style={{ fontSize: "large" }}
                        onClick={() => {
                            sendApiMessage("host_game", { playerId: playerId, matchSystem: SettingMatchSystemToStr(settingMatchSystem) });
                        }}
                    >
                        Host Game
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
                    <h2>Join Game</h2>
                    <input
                        onChange={(e) => {
                            setDuelKey(e.target.value);
                        }}
                    />
                    <button
                        style={{ fontSize: "large" }}
                        onClick={() => {
                            console.log(duelKey);
                            sendApiMessage("join_game", { playerId: playerId, duelKey: duelKey });
                        }}
                    >
                        Join Game
                    </button>
                </>
            )}
            {!gameStarted && gameConnectedTo && (
                <>
                    {!otherPlayerConnected && (
                        <>
                            <p>Your game code is: {duelKey}</p>
                            <p>Waiting for other player...</p>
                        </>
                    )}
                    {otherPlayerConnected && (
                        <button
                            style={{ fontSize: "large" }}
                            onClick={() => {
                                sendApiMessage("start_game", { playerId: playerId, duelKey: duelKey });
                            }}
                        >
                            Start Game
                        </button>
                    )}
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
                                    disabled={localPlayer != currentPlayer}
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
                                        disabled={localPlayer != currentPlayer}
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
                            <TimerContext.Provider value={{ timeLeft: timerTimeLeft, setTimeLeft: setTimerTimeLeft }}>
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
                            </TimerContext.Provider>
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
                                        <div style={{ width: "33.75vw" }} />
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
