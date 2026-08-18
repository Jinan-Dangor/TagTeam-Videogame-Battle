import SteamUser from "steam-user";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
// For hosting on same machine
/*const hostname = "127.0.0.1";
const port = 3001;*/
const hostname = "0.0.0.0";
const port = 3000;
const external_port = 8080;

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const game_name_to_ids_file = path.join(__dirname, "game_name_to_ids.json");
const skipped_ids_file = path.join(__dirname, "skipped_ids.json");
const game_database_file = path.join(__dirname, "game_database.json");
const steam_webapi_key_file = path.join(__dirname, "steam_webapi_key.txt");
const scraped_tags_file = path.join(__dirname, "scrapedTags.json");

/*
    Notes for node-steam-user:
        getProductInfo seem to be a good choice to get data, hope it works without needing to own the game
        getStoreTagNames gets the english names of tags, could be useful and eliminate scraping needs
*/

/*
    Game format:
    {
        name:                   The plaintext name of the game
        developers: []          Developer (plaintext)
        publishers: []          Publisher (plaintext)
        tag_ids: []             IDs of tags
        has_release_date:       Some games don't have a release state or date, this is true if it has either
        steam_release_state:    State of release ('released', 'coming soon', etc)
        steam_release_date:     UNIX timestamp for the game's Steam release date
        review_score:           Number from 0 to 10 representing how good a game is
        review_percentage:      Number from 0 to 100 representing percentage of positive reviews (I believe)
    }

    Derivable information:
        header_image_url:       https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg
*/

let tags = {};
let tagData = {};
let game_database = {};
let game_name_to_ids = new Map();
let skipped_ids = [];
let expected_num_of_games = 0;
let READY_TO_RUN = false;

/*
    Duel format:
    key: duelId
    {
        settings: {             (obj)                       Settings for the duel
            matchSystem         (string)                    "TopFiveTags" or "CalledTags"
        }
        gameStarted             (boolean)                   Has the game started yet?
        gameIsOver              (boolean)                   Has the game ended yet?
        gameResult              (string?)                   "P1Win", "P2Win" or "Draw"
        usedGameIds             (string[])                  List of the game ids already used in this duel
        tagUsedCount            ([id: string]: number)      How many times each tag has been used
        creatorUsedCount        ([creator: string]: number) How many times each creator has been used
        gameHistory: {          (obj[])                     History of each game played this duel
            id                  (string)                    Game's id
            data: {             (obj)                       Game's data
                ...             ('game format' as described above)
            }
            lifelinesUsed       (string[])                  Contains "Skip", "RevealTags" and/or "RevealArt"
        }
        gameLinkHistory: {      (obj[])                     How each game was linked to the next in this duel
            match: {            (obj)
                type            (string)                    "None", "Tags", "Creators", "Skip"
                tagIds          (string[]?)                 If "Tags", ids of the tags used
                creators        (string[]?)                 If "Creators", list of creators
                creatorRolesA   (string[]?)                 If "Creators", list of roles the creator had on first game
                creatorRolesB   (string[]?)                 If "Creators", list of roles the creator had on second game
            }
            counts              (number[])                  How many times each tag/creator has been used so far this game
        }
        currentPlayer           (string)                    "P1" or "P2"
        lifelinesUsed           ((string, string)[])        Map from player to the list of lifelines they've used
    }
*/

let activeDuels = {};
let activeWebsockets = {};
let activePlayers = {};

const generateUniqueKey = (existingKeys) => {
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
    while (existingKeys.includes(key)) {
        key = generateUniqueKey();
    }
    return key;
};

const webSocketServer = new WebSocketServer({ port: external_port });
bootUpServer();

async function bootUpServer() {
    await retrieve_scraped_tags();
    await retrieve_skipped_ids();
    await retrieve_game_name_to_ids();
    await retrieve_game_database();
}

webSocketServer.on("connection", function connection(ws) {
    ws.on("message", function message(data) {
        const newRequest = JSON.parse(data.toString());
        //ws.send("Connection successful!");
        //ws.send(`Data Received: ${data.toString()}`);
        if (newRequest.queryType === null) {
            ws.send(missingParameterErrorResponse("(no queryType provided)", queryId, "queryType"));
            return;
        }
        const queryType = newRequest.queryType;
        if (newRequest.queryId === null) {
            ws.send(missingParameterErrorResponse(queryType, "(no queryId provided)", "queryId"));
            return;
        }
        const queryId = newRequest.queryId;
        console.log(`Received query: ${queryType}`);
        if (!READY_TO_RUN) {
            ws.send(errorResponse(queryType, queryId, "Server not yet ready to receive requests."));
        } else if (queryType === "echo") {
            checkForMissingParameters(ws, queryType, queryId, newRequest, ["content"]);
            const content = newRequest.content;
            ws.send(serverSuccessResponse(queryType, queryId, { content }));
        } else if (queryType === "gen_player_id") {
            let newPlayerKey = generateUniqueKey(Object.keys(activePlayers));
            activePlayers[newPlayerKey] = {
                websocket: ws,
            };
            activeWebsockets[ws] = {
                playerId: newPlayerKey,
            };
            ws.send(serverSuccessResponse(queryType, queryId, { key: newPlayerKey }));
        } else if (queryType === "game_info") {
            if (!checkForMissingParameters(ws, queryType, queryId, newRequest, ["gameId"])) {
                return;
            }
            const game = game_database[newRequest.gameId];
            ws.send(serverSuccessResponse(queryType, queryId, { gameData: game }));
        } else if (queryType === "autocomplete_games") {
            if (!checkForMissingParameters(ws, queryType, queryId, newRequest, ["searchTerm"])) {
                return;
            }
            const search_term = simplify_game_name_search_term(decodeURIComponent(newRequest.searchTerm));
            const valid_games = Object.keys(game_database)
                .filter((id) => simplify_game_name_search_term(game_database[id].name).includes(search_term))
                .map((id) => {
                    return {
                        id,
                        name: game_database[id].name,
                        year_text: getReleaseYearString(game_database[id]),
                        review_percentage: Number(game_database[id].review_percentage),
                        review_score: Number(game_database[id].review_score),
                    };
                })
                .sort((a, b) => {
                    const simple_name_a = simplify_game_name_search_term(a.name);
                    const simple_name_b = simplify_game_name_search_term(b.name);
                    const score_a = a.review_percentage + 10 * a.review_score;
                    const starting_mod_a = simple_name_a.startsWith(search_term) ? 1000 : 0;
                    const perfect_mod_a = simple_name_a == search_term ? 10000 : 0;
                    const score_b = b.review_percentage + 10 * b.review_score;
                    const starting_mod_b = simple_name_b.startsWith(search_term) ? 1000 : 0;
                    const perfect_mod_b = simple_name_b == search_term ? 10000 : 0;
                    const final_score_a = score_a + starting_mod_a + perfect_mod_a;
                    const final_score_b = score_b + starting_mod_b + perfect_mod_b;
                    return final_score_b - final_score_a;
                })
                .slice(0, 10);
            ws.send(serverSuccessResponse(queryType, queryId, { searchResults: valid_games }));
        } else if (queryType === "host_game") {
            if (!checkForMissingParameters(ws, queryType, queryId, newRequest, ["playerId"])) {
                return;
            }
            const playerId = newRequest.playerId;
            if (!Object.keys(activePlayers).includes(playerId)) {
                console.log(playerId);
                console.log(activePlayers);
                ws.send(errorResponse(queryType, queryId, "Player id not found, refresh your page"));
                return;
            }
            let newDuelKey = generateUniqueKey(Object.keys(activeDuels));
            const startingGameId = "440";
            activeDuels[newDuelKey] = {
                settings: {
                    matchSystem: "CalledTags",
                },
                gameStarted: false,
                gameIsOver: false,
                gameResult: null,
                usedGameIds: [startingGameId],
                tagUsedCount: {},
                creatorUsedCount: {},
                gameHistory: [
                    {
                        id: startingGameId,
                        data: game_database[startingGameId],
                        lifelinesUsed: [],
                    },
                ],
                gameLinkHistory: [],
                playerIds: [playerId],
                currentPlayer: "P1",
                lifelinesUsed: [
                    ["P1", []],
                    ["P2", []],
                ],
            };
            activePlayers[playerId].currentDuelId = newDuelKey;
            ws.send(serverSuccessResponse(queryType, queryId, { newDuelKey }));
        } else if (queryType === "start_game") {
            if (!checkForMissingParameters(ws, queryType, queryId, newRequest, ["duelKey", "playerId"])) {
                return;
            }
            const duelKey = newRequest.duelKey;
            const playerId = newRequest.playerId;
            if (Object.keys(activeDuels).includes(duelKey)) {
                activeDuels[duelKey].gameStarted = true;
                ws.send(serverSuccessResponse(queryType, queryId, { duelKey }));
                const index = activeDuels[duelKey].playerIds.indexOf(playerId);
                activePlayers[activeDuels[duelKey].playerIds[1 - index]].websocket.send(serverSuccessResponse(queryType, queryId, { duelKey }));
            } else {
                ws.send(errorResponse(queryType, queryId, "Duel id not found"));
            }
        } else if (queryType === "join_game") {
            if (!checkForMissingParameters(ws, queryType, queryId, newRequest, ["duelKey", "playerId"])) {
                return;
            }
            const playerId = newRequest.playerId;
            if (!Object.keys(activePlayers).includes(playerId)) {
                ws.send(errorResponse(queryType, queryId, "Player id not found, refresh the page"));
                return;
            }
            const duelKey = newRequest.duelKey;
            if (Object.keys(activeDuels).includes(duelKey)) {
                if (activeDuels[duelKey].gameStarted) {
                    ws.send(errorResponse(queryType, queryId, "Game already in progress."));
                }
                if (activeDuels[duelKey].playerIds.length > 1) {
                    ws.send(errorResponse(queryType, queryId, "Game already has two players."));
                }
                activeDuels[duelKey].playerIds.push(playerId);
                activePlayers[playerId].currentDuelId = duelKey;
                ws.send(serverSuccessResponse(queryType, queryId, { duelKey }));
                activePlayers[activeDuels[duelKey].playerIds[0]].websocket.send(serverSuccessResponse("player_joined", queryId, {}));
            } else {
                ws.send(errorResponse(queryType, queryId, "Duel id not found"));
            }
        } else if (queryType === "turn_started") {
        } else if (queryType === "make_guess") {
            if (!checkForMissingParameters(ws, queryType, queryId, newRequest, ["duelKey", "playerId", "gameId"])) {
                return;
            }
            let matchResult;
            const duelKey = newRequest.duelKey;
            const playerId = newRequest.playerId;
            const gameId = newRequest.gameId;
            const index = activeDuels[duelKey].playerIds.indexOf(playerId);
            const game = game_database[gameId];
            const matchingSystem = activeDuels[duelKey].settings.matchSystem;
            const duelHistory = activeDuels[duelKey].gameHistory;
            const latestHistory = duelHistory[duelHistory.length - 1];
            const tagUsedCount = activeDuels[duelKey].tagUsedCount;
            const creatorUsedCount = activeDuels[duelKey].creatorUsedCount;
            const selectedTag = newRequest?.selectedTag;
            if (matchingSystem === "TopFiveTags") {
                matchResult = compareGameTopTags(latestHistory.data, game);
            } else if (matchingSystem === "CalledTags") {
                matchResult = compareGameCalledTag(latestHistory.data, game, selectedTag);
            } else {
                console.error("Setting 'Match System' not set to known value.");
                return;
            }
            let newCounts = [];
            let newDict;
            if (matchResult.type === MatchType.Tags) {
                newDict = {};
                for (let i = 0; i < (matchResult.tag_ids?.length ?? 0); i++) {
                    const newTagId = matchResult.tag_ids?.[i] ?? 0;
                    if (tagUsedCount[newTagId] >= 3) {
                        ws.send(
                            serverSuccessResponse(queryType, queryId, {
                                errorText: `${tagData[newTagId].name} has already been played 3 times.`,
                            }),
                        );
                        return;
                    }
                    if (newTagId in tagUsedCount) {
                        newDict[newTagId] = tagUsedCount[newTagId] + 1;
                        activeDuels[duelKey].tagUsedCount[newTagId] += 1;
                        newCounts.push(tagUsedCount[newTagId]);
                    } else {
                        newDict[newTagId] = 1;
                        activeDuels[duelKey].tagUsedCount[newTagId] = 1;
                        newCounts.push(1);
                    }
                }
            }
            if (matchResult.type === MatchType.Creators) {
                newDict = {};
                for (let i = 0; i < (matchResult.creators?.length ?? 0); i++) {
                    const newCreatorName = matchResult.creators?.[i] ?? 0;
                    if (creatorUsedCount[newCreatorName] >= 3) {
                        ws.send(
                            serverSuccessResponse(queryType, queryId, {
                                errorText: `${newCreatorName} has already been played 3 times.`,
                            }),
                        );
                        return;
                    }
                    if (newCreatorName in creatorUsedCount) {
                        newDict[newCreatorName] = creatorUsedCount[newCreatorName] + 1;
                        activeDuels[duelKey].creatorUsedCount[newCreatorName] += 1;
                        newCounts.push(creatorUsedCount[newCreatorName]);
                    } else {
                        newDict[newCreatorName] = 1;
                        activeDuels[duelKey].creatorUsedCount[newCreatorName] = 1;
                        newCounts.push(1);
                    }
                }
            }
            if (matchResult.type !== MatchType.None) {
                activeDuels[duelKey].gameHistory.push({ id: gameId, data: game, lifelinesUsed: [] });
            }
            ws.send(serverSuccessResponse(queryType, queryId, { guessData: { gameId, gameData: game, matchResult, newCounts, newDict } }));
            activePlayers[activeDuels[duelKey].playerIds[1 - index]].websocket.send(
                serverSuccessResponse(queryType, queryId, { guessData: { gameId, gameData: game, matchResult, newCounts, newDict } }),
            );
        } else if (queryType === "use_lifeline") {
            if (!checkForMissingParameters(ws, queryType, queryId, newRequest, ["duelKey", "playerId", "lifelineUsed"])) {
                return;
            }
            const duelKey = newRequest.duelKey;
            const playerId = newRequest.playerId;
            const index = activeDuels[duelKey].playerIds.indexOf(playerId);
            const lifelineUsed = newRequest.lifelineUsed;
            activePlayers[activeDuels[duelKey].playerIds[1 - index]].websocket.send(serverSuccessResponse(queryType, queryId, { lifelineUsed }));
        } else if (queryType === "get_duel_state") {
            if (!checkForMissingParameters(ws, queryType, queryId, newRequest, ["duelKey"])) {
                return;
            }
            const duelKey = newRequest.duelKey;
            if (!activeDuels[duelKey]) {
                ws.send(errorResponse(queryType, queryId, `duelKey '${duelKey}' not found.`));
                return;
            }
            ws.send(serverSuccessResponse(queryType, queryId, { ...activeDuels[duelKey] }));
        } else {
            ws.send(errorResponse(queryType, queryId, `Query type '${queryType}' not recognised.`));
        }
    });

    ws.on("close", function disconnect(data) {
        const playerId = activeWebsockets[ws].playerId;
        if (activePlayers[playerId].currentDuelId != null) {
            const duelKey = activePlayers[playerId].currentDuelId;
            const index = activeDuels[duelKey].playerIds.indexOf(playerId);
            activeDuels[duelKey].playerIds[index] = "<disconnected>";
            if (activeDuels[duelKey].playerIds[1 - index] != "<disconnected>") {
                activePlayers[activeDuels[duelKey].playerIds[1 - index]].websocket.send(serverSuccessResponse("player_disconnected", "", {}));
            } else {
                delete activeDuels[duelKey];
            }
        }
        delete activePlayers[playerId];
    });
});

function serverSuccessResponse(queryType, queryId, payload) {
    return JSON.stringify({
        queryType,
        queryId,
        success: true,
        ...payload,
    });
}

function errorResponse(queryType, queryId, errorMessage) {
    return JSON.stringify({
        queryType,
        queryId,
        success: false,
        errorMessage,
    });
}

function checkForMissingParameters(ws, queryType, queryId, query, parameters) {
    let missingParametersFound = false;
    parameters.forEach((p) => {
        if (query[p] == null) {
            ws.send(missingParameterErrorResponse(queryType, queryId, p));
            missingParametersFound = true;
        }
    });
    return !missingParametersFound;
}

function missingParameterErrorResponse(queryType, queryId, parameter) {
    return errorResponse(queryType, queryId, `Parameter '${parameter}' missing from request.`);
}

function server_ready() {
    console.log(`Server running on port ${external_port}`);
    READY_TO_RUN = true;
    return;
}

async function retrieve_scraped_tags() {
    if (fs.existsSync(scraped_tags_file)) {
        tags = JSON.parse(fs.readFileSync(scraped_tags_file, { encoding: "utf-8" }));
        tags.forEach((tag) => (tagData[tag.ID] = { name: tag.name, emoji: tag.emoji }));
    }
}

async function retrieve_skipped_ids() {
    if (fs.existsSync(skipped_ids_file)) {
        skipped_ids = JSON.parse(fs.readFileSync(skipped_ids_file, { encoding: "utf-8" }));
    }
}

async function retrieve_game_name_to_ids() {
    if (!fs.existsSync(game_name_to_ids_file)) {
        console.log(`Mapping from game names to ids absent, generating...`);
        const generation_success = await store_game_name_to_ids();
        if (generation_success) {
            console.log(`Generated.`);
        } else {
            return;
        }
    }
    game_name_to_ids = new Map(Object.entries(JSON.parse(fs.readFileSync(game_name_to_ids_file, { encoding: "utf-8" }))));
    expected_num_of_games = Array.from(game_name_to_ids.values()).reduce((partialSum, a) => partialSum + a.length, 0);
}

async function retrieve_game_database() {
    if (fs.existsSync(game_database_file)) {
        game_database = JSON.parse(fs.readFileSync(game_database_file, { encoding: "utf-8" }));
        if (Object.keys(game_database).length + skipped_ids.length < expected_num_of_games) {
            console.log(`Expected ${expected_num_of_games} games, only found ${Object.keys(game_database).length + skipped_ids.length} in database. Recovering missing games...`);
        } else {
            server_ready();
            return;
        }
    } else {
        console.log(`Games database missing, generating...`);
    }
    await store_game_database();
}

async function store_game_name_to_ids() {
    let steam_webapi_data = {};
    let webapi_key = "";
    if (!fs.existsSync(steam_webapi_key_file)) {
        console.error(`Steam WebAPI key not found - cannot generate list of IDs. Game will continue as normal if database is present.`);
        return false;
    } else {
        webapi_key = fs.readFileSync(steam_webapi_key_file, { encoding: "utf-8" });
    }

    {
        const fetch_response = await fetch(`https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${webapi_key}&have_description_language=english&max_results=50000`).catch(function (err) {
            console.log("Unable to fetch -", err);
        });

        const json_response = await fetch_response.text();
        if (!json_response) {
            console.log("Cannot construct list of game ids due to rate limited API, try again later.");
            return false;
        }

        steam_webapi_data = JSON.parse(json_response).response;
    }

    let games_list = steam_webapi_data.apps;
    let more_games = steam_webapi_data.have_more_results;
    while (more_games) {
        console.log(`${games_list.length} games found`);
        const last_appid = steam_webapi_data.last_appid;
        const fetch_response = await fetch(
            `https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${webapi_key}&have_description_language=english&last_appid=${last_appid}&max_results=50000`,
        ).catch(function (err) {
            console.log("Unable to fetch -", err);
        });

        const json_response = await fetch_response.text();
        if (!json_response) {
            console.log("Cannot construct list of game ids due to rate limited API, try again later.");
            return false;
        }

        steam_webapi_data = JSON.parse(json_response).response;
        games_list = games_list.concat(steam_webapi_data.apps);
        more_games = steam_webapi_data.have_more_results;
    }
    console.log(`${games_list.length} games found`);

    for (let i = 0; i < games_list.length; i++) {
        if (!filter_game_by_name(games_list[i].name)) {
            continue;
        }
        const simple_name = simplify_game_name_search_term(games_list[i].name);
        if (game_name_to_ids.get(simple_name) == undefined) {
            game_name_to_ids.set(simple_name, []);
        }
        game_name_to_ids.get(simple_name).push(games_list[i].appid);
    }
    fs.writeFileSync(game_name_to_ids_file, JSON.stringify(Object.fromEntries(game_name_to_ids)), (err) => {
        if (err) {
            console.log("Unable to write -", err);
        }
    });
    return true;
}

async function store_game_database(limit = undefined) {
    if (!limit) {
        limit = game_name_to_ids.size;
    }
    if (limit > game_name_to_ids.size - 1) {
        limit = game_name_to_ids.size - 1;
    }
    const notification_period_in_games = 100;
    const map_keys = Array.from(game_name_to_ids.keys());
    let database = {};
    const client = new SteamUser();
    client.logOn({ anonymous: true });
    client.on("loggedOn", async () => {
        console.log("Successfully logged on to Steam interface.");
        console.log(`Every ${notification_period_in_games} games, you will be notified of progress and progress will be saved.`);
        let games_added = 0;
        const start_time = Date.now();
        keyLoop: for (let i = 0; games_added < limit && i < map_keys.length; i++) {
            const relevant_ids = game_name_to_ids.get(map_keys[i]);
            for (let j = 0; j < relevant_ids.length; j++) {
                const target_game_id = relevant_ids[j];
                //console.log(target_game_id);
                if (game_database[target_game_id] || skipped_ids.includes(target_game_id)) {
                    continue;
                }
                try {
                    const steamuser_response = await client.getProductInfo([target_game_id], [], (err) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                    if (steamuser_response.unknownApps.length > 0) {
                        skipped_ids.push(target_game_id);
                        continue;
                    }
                    const steamuser_data = steamuser_response.apps[target_game_id].appinfo;
                    if (!steamuser_data?.common?.name) {
                        skipped_ids.push(target_game_id);
                        continue;
                    }
                    const name = steamuser_data.common.name;
                    let developers = [];
                    let publishers = [];
                    const associations = steamuser_data.common.associations;
                    const association_indices = Object.keys(associations);
                    for (let i = 0; i < association_indices.length; i++) {
                        if (associations[association_indices[i]].type == "developer") {
                            developers.push(associations[association_indices[i]].name);
                        } else if (associations[association_indices[i]].type == "publisher") {
                            publishers.push(associations[association_indices[i]].name);
                        }
                    }
                    const tag_ids = steamuser_data.common.store_tags ? Object.values(steamuser_data.common.store_tags) : [];
                    const has_release_date = steamuser_data?.common?.steam_release_date != undefined || steamuser_data?.common?.ReleaseState != undefined;
                    const steam_release_state = steamuser_data?.common?.ReleaseState;
                    const steam_release_date = steamuser_data?.common?.steam_release_date;
                    const review_score = steamuser_data.common.review_score ?? 0;
                    const review_percentage = steamuser_data.common.review_percentage ?? 0;
                    const database_entry = {
                        name,
                        developers,
                        publishers,
                        tag_ids,
                        has_release_date,
                        steam_release_state,
                        steam_release_date,
                        review_score,
                        review_percentage,
                    };
                    games_added++;
                    if (games_added % notification_period_in_games == 0) {
                        console.log(`${games_added} games added.`);
                        game_database = { ...game_database, ...database };
                        fs.writeFileSync(game_database_file, JSON.stringify(game_database), (err) => {
                            if (err) {
                                console.log("Unable to write -", err);
                            }
                        });
                        fs.writeFileSync(skipped_ids_file, JSON.stringify(skipped_ids), (err) => {
                            if (err) {
                                console.log("Unable to write -", err);
                            }
                        });
                    }
                    database[target_game_id] = database_entry;
                } catch (err) {
                    console.log(`The following error occurred while parsing game with ID ${target_game_id}, skipping.`);
                    console.log(err);
                }
            }
        }
        client.logOff();
        console.log("Successfully logged off from Steam interface.");
        game_database = { ...game_database, ...database };
        fs.writeFileSync(game_database_file, JSON.stringify(game_database), (err) => {
            if (err) {
                console.log("Unable to write -", err);
            }
        });
        const num_entries_not_found = expected_num_of_games - Object.keys(game_database).length - skipped_ids.length;
        if (num_entries_not_found == 0) {
            console.log(`Generated.`);
        } else {
            console.log(`Incomplete database recovery - missing ${num_entries_not_found} records (have ${Object.keys(game_database).length + skipped_ids.length}). Rerun server to continue download.`);
        }
        const end_time = Date.now();
        const elapsed_time = new Date(end_time - start_time);
        console.log(`Operations completed in ${elapsed_time / 1000 / 60} minutes.`);
        server_ready();
    });
}

function simplify_game_name_search_term(game_name) {
    return game_name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function filter_game_by_name(game_name) {
    const simplified_name = simplify_game_name_search_term(game_name);
    const numbers_only_name = game_name.replace(/[^0-9]/g, "");
    if (simplified_name == "" || (game_name != simplified_name && simplified_name == numbers_only_name)) {
        return false;
    }
    return true;
}

function getReleaseYearString(game) {
    if (!game.has_release_date) {
        return "";
    }
    if (game.steam_release_date == 0) {
        return "Coming Soon";
    }
    return `${getYear(game.steam_release_date)}`;
}

function getYear(unix) {
    return new Date(unix * 1000).getFullYear();
}

// GAMING HELPER FUNCTIONS
const MatchType = {
    None: "None",
    Tags: "Tags",
    Creators: "Creators",
    Skip: "Skip",
};

const compareGames = (gameA, gameB) => {
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

const TOP_TAG_LIMIT = 5;
const compareGameTopTags = (gameA, gameB) => {
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

const compareGameCalledTag = (gameA, gameB, calledTag) => {
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
