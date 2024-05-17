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

enum MatchType {
    None,
    Tags,
    Creators,
}

type MatchData = {
    type: MatchType;
    tag_ids?: number[];
    creators?: string[];
    creator_roles_a?: string[];
    creator_roles_b?: string[];
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
    const [lastGameId, setLastGameId] = useState<string>("");
    const [currentGameId, setCurrentGameId] = useState<string>("440");
    const [newGameId, setNewGameId] = useState<string>("");
    const [nameSearchTerm, setNameSearchTerm] = useState<string>("");
    const [lastGameData, setLastGameData] = useState<GameData | null>(null);
    const [currentGameData, setCurrentGameData] = useState<GameData | null>(
        null
    );
    const [suggestions, setSuggestions] = useState<AutocompleteData[]>([]);
    const [matchType, setMatchType] = useState<MatchData | null>(null);
    let tag_data: { [id: string]: TagData } = {};
    tags.forEach(
        (tag) => (tag_data[tag.ID] = { name: tag.name, emoji: tag.emoji })
    );

    useEffect(() => {
        fetch(`http://127.0.0.1:3001/?game_info=${currentGameId}`).then(
            async (response) => {
                const response_json = await response.json();
                if (response_json.responses[0].success) {
                    const first_game_data = response_json.responses[0];
                    setCurrentGameData(first_game_data);
                }
            }
        );
    }, []);

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
            }
        });
    }, [nameSearchTerm]);

    useEffect(() => {
        setErrorText(``);
        if (newGameId != "") {
            search_for_game(newGameId);
        }
    }, [newGameId]);

    const search_for_game = (id: string) => {
        fetch(`http://127.0.0.1:3001/?game_info=${id}`).then(
            async (response) => {
                const response_json = await response.json();
                if (response_json.responses[0].success) {
                    const new_game_data = response_json.responses[0];
                    if (usedGameIds.includes(newGameId)) {
                        setErrorText(
                            `${new_game_data.name} has already been played.`
                        );
                        return;
                    }
                    if (currentGameData) {
                        const match_result = compare_games(
                            currentGameData,
                            new_game_data
                        );
                        if (match_result.type == MatchType.Tags) {
                            let new_dict: { [id: string]: number } = {};
                            for (
                                let i = 0;
                                i < (match_result.tag_ids?.length ?? 0);
                                i++
                            ) {
                                const new_tag_id =
                                    match_result.tag_ids?.[i] ?? 0;
                                if (tagUsedCount[new_tag_id] >= 3) {
                                    setErrorText(
                                        `${tag_data[new_tag_id].name} has already been played 3 times.`
                                    );
                                    return;
                                }
                                if (new_tag_id in tagUsedCount) {
                                    new_dict[new_tag_id] =
                                        tagUsedCount[new_tag_id] + 1;
                                } else {
                                    new_dict[new_tag_id] = 1;
                                }
                            }
                            setTagUsedCount({ ...tagUsedCount, ...new_dict });
                        }
                        if (match_result.type == MatchType.Creators) {
                            let new_dict: { [creator: string]: number } = {};
                            for (
                                let i = 0;
                                i < (match_result.creators?.length ?? 0);
                                i++
                            ) {
                                const new_creator_name =
                                    match_result.creators?.[i] ?? 0;
                                if (creatorUsedCount[new_creator_name] >= 3) {
                                    setErrorText(
                                        `${new_creator_name} has already been played 3 times.`
                                    );
                                    return;
                                }
                                if (new_creator_name in creatorUsedCount) {
                                    new_dict[new_creator_name] =
                                        creatorUsedCount[new_creator_name] + 1;
                                } else {
                                    new_dict[new_creator_name] = 1;
                                }
                            }
                            setCreatorUsedCount({
                                ...creatorUsedCount,
                                ...new_dict,
                            });
                        }
                        if (match_result.type != MatchType.None) {
                            setLastGameId(currentGameId);
                            setCurrentGameId(newGameId);
                            setLastGameData(currentGameData);
                            setCurrentGameData(new_game_data);
                            setMatchType(match_result);
                            setNewGameId("");
                            setUsedGameIds([...usedGameIds, newGameId]);
                        } else {
                            setMatchType(match_result);
                            setNewGameId("");
                        }
                    }
                }
            }
        );
    };

    const compare_games = (game_a: GameData, game_b: GameData): MatchData => {
        const shared_tags = game_a.tag_ids
            .slice(0, TOP_TAG_LIMIT)
            .filter((tag) =>
                game_b.tag_ids.slice(0, TOP_TAG_LIMIT).includes(tag)
            );
        const shared_creators = game_a.developers
            .concat(game_a.publishers)
            .filter((creator) =>
                game_b.developers.concat(game_b.publishers).includes(creator)
            );
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
                creator_roles_a: creator_roles.map(
                    (creator) => creator.creator_role_a
                ),
                creator_roles_b: creator_roles.map(
                    (creator) => creator.creator_role_b
                ),
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
            <div>
                <AutocompleteInput
                    value={nameSearchTerm}
                    setValue={(value) => {
                        setNewGameId(value);
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
                        setNewGameId(suggestions[0].id);
                        search_for_game(suggestions[0].id);
                    }}
                >
                    Search by Name
                </button>
            </div>
            {errorText != "" && <p style={{ color: "#f33" }}>{errorText}</p>}
            {matchType && (
                <>
                    {matchType.type == MatchType.None && (
                        <div>No matches found. Try again.</div>
                    )}
                    {matchType.type == MatchType.Tags && (
                        <>
                            <div>
                                Success! Game matches on the following tags:
                            </div>
                            {matchType.tag_ids?.map((tag_id) => (
                                <p key={tag_id}>
                                    {unescapeChars(tag_data[tag_id].name)}{" "}
                                    {tag_data[tag_id].emoji}{" "}
                                    {[1, 2, 3].map((num) =>
                                        tagUsedCount[tag_id] >= num
                                            ? String.fromCodePoint(0x2611)
                                            : String.fromCodePoint(0x2610)
                                    )}
                                </p>
                            ))}
                        </>
                    )}
                    {matchType.type == MatchType.Creators && (
                        <>
                            <div>Success!</div>
                            {
                                <>
                                    {matchType.creators?.map((creator) => {
                                        const creator_role_a =
                                            matchType?.creator_roles_a?.[
                                                matchType?.creators?.indexOf(
                                                    creator
                                                ) ?? 0
                                            ];
                                        const creator_role_b =
                                            matchType?.creator_roles_b?.[
                                                matchType?.creators?.indexOf(
                                                    creator
                                                ) ?? 0
                                            ];
                                        return (
                                            <p>
                                                {creator} was the{" "}
                                                {creator_role_a} of{" "}
                                                {lastGameData?.name} and{" "}
                                                {creator_role_b} of{" "}
                                                {currentGameData?.name}{" "}
                                                {[1, 2, 3].map((num) =>
                                                    creatorUsedCount[creator] >=
                                                    num
                                                        ? String.fromCodePoint(
                                                              0x2611
                                                          )
                                                        : String.fromCodePoint(
                                                              0x2610
                                                          )
                                                )}
                                            </p>
                                        );
                                    })}
                                </>
                            }
                        </>
                    )}
                </>
            )}
            {currentGameData && (
                <>
                    <p>Current Game: {currentGameData.name}</p>
                    <img
                        src={`https://cdn.akamai.steamstatic.com/steam/apps/${currentGameId}/header.jpg`}
                    />
                </>
            )}
        </div>
    );
};

export default GameScreen;
