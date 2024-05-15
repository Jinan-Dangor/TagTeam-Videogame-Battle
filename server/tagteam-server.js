import api_key from "./steam_webapi_key.js";
import SteamUser from "steam-user";
import { createServer } from "node:http";
const hostname = "127.0.0.1";
const port = 3000;

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const game_name_to_ids_file = path.join(__dirname, "game_name_to_ids.json");
const skipped_ids_file = path.join(__dirname, "skipped_ids.json");
const game_database_file = path.join(__dirname, "game_database.json");

/*
    Notes for node-steam-user:
        getProductInfo seem to be a good choice to get data, hope it works without needing to own the game
        getStoreTagNames gets the english names of tags, could be useful and eliminate scraping needs

        The header image is stored at a url with a consistent format, so you can get it from there
        Other stuff might just not be attainable, but everything essential seems available
        If needed, you can gradually acquire the 'cool' info for the most popular games as they're chosen
        Note that app_info_print (the steam command line argument effectively being used) sometimes has to run a 'request' before getting the data successfully
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
*/

/*
    Notes about testing:
    Bioshock Remastered has multiple developers and publishers
*/

let game_database = {};
let game_name_to_ids = new Map();
let skipped_ids = [];
let expected_num_of_games = 0;
let READY_TO_RUN = false;

const server = createServer(async (req, res) => {
    const url_query_parameters = req.url;
    const query_strings = url_query_parameters.split("?").slice(1);
    const query_objects = query_strings.map((str) => {
        const query_halves = str.split("=");
        const query_type = query_halves[0];
        const query_body = query_halves[1];
        return {
            type: query_type,
            body: query_body,
        };
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    let response = "";
    for (let i = 0; i < query_objects.length; i++) {
        if (!READY_TO_RUN) {
            response += "Server not yet ready to recieve requests.";
            break;
        }
        if (query_objects[i].type == "game_info") {
            const target_game_id = query_objects[i].body;
            const game = game_database[target_game_id];
            response += `You requested the info of the game ${game.name} (${
                game.year
            }) $${game.price / 100}. Developed by ${
                game.developers
            } and published by ${
                game.publishers
            }. Contains the tags ${Object.keys(game.tag_names)}.`;
        } else if (query_objects[i].type == "game_name_search") {
            const game_name = decodeURIComponent(query_objects[i].body);
            const game_search_name = simplify_game_name_search_term(game_name);
            if (game_name_to_ids.get(game_search_name)) {
                response +=
                    "The id of your game is: " +
                    game_name_to_ids.get(game_search_name);
            } else {
                response += "No game found under name: " + game_name;
            }
        } else {
            response += "Unrecognised query type " + query_objects[i].type;
        }
        response += "\n";
    }
    res.end(response);
});

server.listen(port, hostname, async () => {
    await retrieve_skipped_ids();
    await retrieve_game_name_to_ids();
    await retrieve_game_database();
});

function server_ready() {
    console.log(`Server running at http://${hostname}:${port}/`);
    READY_TO_RUN = true;
    return;
}

async function retrieve_skipped_ids() {
    if (fs.existsSync(skipped_ids_file)) {
        skipped_ids = JSON.parse(
            fs.readFileSync(skipped_ids_file, { encoding: "utf-8" })
        );
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
    game_name_to_ids = new Map(
        Object.entries(
            JSON.parse(
                fs.readFileSync(game_name_to_ids_file, { encoding: "utf-8" })
            )
        )
    );
    expected_num_of_games = Array.from(game_name_to_ids.values()).reduce(
        (partialSum, a) => partialSum + a.length,
        0
    );
}

async function retrieve_game_database() {
    if (fs.existsSync(game_database_file)) {
        game_database = JSON.parse(
            fs.readFileSync(game_database_file, { encoding: "utf-8" })
        );
        if (
            Object.keys(game_database).length + skipped_ids.length <
            expected_num_of_games
        ) {
            console.log(
                `Expected ${expected_num_of_games} games, only found ${
                    Object.keys(game_database).length + skipped_ids.length
                } in database. Recovering missing games...`
            );
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

    {
        const fetch_response = await fetch(
            `https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${api_key}&have_description_language=english&max_results=50000`
        ).catch(function (err) {
            console.log("Unable to fetch -", err);
        });

        const json_response = await fetch_response.text();
        if (!json_response) {
            console.log(
                "Cannot construct list of game ids due to rate limited API, try again later."
            );
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
            `https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${api_key}&have_description_language=english&last_appid=${last_appid}&max_results=50000`
        ).catch(function (err) {
            console.log("Unable to fetch -", err);
        });

        const json_response = await fetch_response.text();
        if (!json_response) {
            console.log(
                "Cannot construct list of game ids due to rate limited API, try again later."
            );
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
    fs.writeFileSync(
        game_name_to_ids_file,
        JSON.stringify(Object.fromEntries(game_name_to_ids)),
        (err) => {
            if (err) {
                console.log("Unable to write -", err);
            }
        }
    );
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
        console.log(
            `Every ${notification_period_in_games} games, you will be notified of progress and progress will be saved.`
        );
        let games_added = 0;
        const start_time = Date.now();
        keyLoop: for (
            let i = 0;
            games_added < limit && i < map_keys.length;
            i++
        ) {
            const relevant_ids = game_name_to_ids.get(map_keys[i]);
            for (let j = 0; j < relevant_ids.length; j++) {
                const target_game_id = relevant_ids[j];
                //console.log(target_game_id);
                if (
                    game_database[target_game_id] ||
                    skipped_ids.includes(target_game_id)
                ) {
                    continue;
                }
                try {
                    const steamuser_response = await client.getProductInfo(
                        [target_game_id],
                        [],
                        (err) => {
                            if (err) {
                                console.log(err);
                            }
                        }
                    );
                    if (steamuser_response.unknownApps.length > 0) {
                        skipped_ids.push(target_game_id);
                        continue;
                    }
                    const steamuser_data =
                        steamuser_response.apps[target_game_id].appinfo;
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
                        if (
                            associations[association_indices[i]].type ==
                            "developer"
                        ) {
                            developers.push(
                                associations[association_indices[i]].name
                            );
                        } else if (
                            associations[association_indices[i]].type ==
                            "publisher"
                        ) {
                            publishers.push(
                                associations[association_indices[i]].name
                            );
                        }
                    }
                    const tag_ids = steamuser_data.common.store_tags
                        ? Object.values(steamuser_data.common.store_tags)
                        : [];
                    const has_release_date =
                        steamuser_data?.common?.steam_release_date !=
                            undefined ||
                        steamuser_data?.common?.ReleaseState != undefined;
                    const steam_release_state =
                        steamuser_data?.common?.ReleaseState;
                    const steam_release_date =
                        steamuser_data?.common?.steam_release_date;
                    const review_score =
                        steamuser_data.common.review_score ?? 0;
                    const review_percentage =
                        steamuser_data.common.review_percentage ?? 0;
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
                        fs.writeFileSync(
                            game_database_file,
                            JSON.stringify(game_database),
                            (err) => {
                                if (err) {
                                    console.log("Unable to write -", err);
                                }
                            }
                        );
                        fs.writeFileSync(
                            skipped_ids_file,
                            JSON.stringify(skipped_ids),
                            (err) => {
                                if (err) {
                                    console.log("Unable to write -", err);
                                }
                            }
                        );
                    }
                    database[target_game_id] = database_entry;
                } catch (err) {
                    console.log(
                        `The following error occured while parsing game with ID ${target_game_id}, skipping.`
                    );
                    console.log(err);
                }
            }
        }
        client.logOff();
        console.log("Successfully logged off from Steam interface.");
        game_database = { ...game_database, ...database };
        fs.writeFileSync(
            game_database_file,
            JSON.stringify(game_database),
            (err) => {
                if (err) {
                    console.log("Unable to write -", err);
                }
            }
        );
        const num_entries_not_found =
            expected_num_of_games -
            Object.keys(game_database).length -
            skipped_ids.length;
        if (num_entries_not_found == 0) {
            console.log(`Generated.`);
        } else {
            console.log(
                `Incomplete database recovery - missing ${num_entries_not_found} records (have ${
                    Object.keys(game_database).length + skipped_ids.length
                }). Rerun server to continue download.`
            );
        }
        const end_time = Date.now();
        const elapsed_time = new Date(end_time - start_time);
        console.log(
            `Operations completed in ${elapsed_time / 1000 / 60} minutes.`
        );
        server_ready();
    });
}

function simplify_game_name_search_term(game_name) {
    return game_name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function filter_game_by_name(game_name) {
    const simplified_name = simplify_game_name_search_term(game_name);
    const numbers_only_name = game_name.replace(/[^0-9]/g, "");
    if (
        simplified_name == "" ||
        (game_name != simplified_name && simplified_name == numbers_only_name)
    ) {
        return false;
    }
    return true;
}
