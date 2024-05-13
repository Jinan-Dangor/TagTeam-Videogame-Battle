const { createServer } = require("node:http");
const hostname = "127.0.0.1";
const port = 3000;

/*
    Game format:
    {
        name:               The plaintext name of the game
        price:              Price in AUD cents, unformatted - Coming Soon if price not assigned
        developers: []      Developer (plaintext)
        publishers: []      Publisher (plaintext)
        tag_names: []       Plaintext names of tags
        pos_reviews:        Number of positive reviews
        available_in_aus:   Items unavailable in Australia won't have a year, short_desc or header_image and price will be in USD cents
        year:               Year of release
        short_desc:         Short description of the game
        header_image:       Thumbnail image used for the game
    }
*/
let game_database = {};
let game_name_to_ids = new Map();

const fs = require("node:fs");
const path = require("path");
const game_name_to_ids_file = path.join(__dirname, "game_name_to_ids.json");
const game_database_file = path.join(__dirname, "game_database.json");

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
    let already_broken_early = false;
    if (!fs.existsSync(game_database_file)) {
        console.log(`Games database missing, generating...`);
        const num_entries_not_found = await store_game_database();
        if (num_entries_not_found == 0) {
            console.log(`Generated.`);
        } else {
            console.log(
                `Incomplete database recovery - missing ${num_entries_not_found} records. Rerun server to continue download.`
            );
            already_broken_early = true;
        }
    }
    game_database = JSON.parse(
        fs.readFileSync(game_database_file, { encoding: "utf-8" })
    );
    const expected_num_of_games = Array.from(game_name_to_ids.values()).reduce(
        (partialSum, a) => partialSum + a.length,
        0
    );
    if (
        !already_broken_early &&
        Object.keys(game_database).length < expected_num_of_games
    ) {
        console.log(
            `Expected ${expected_num_of_games} games, only found ${
                Object.keys(game_database).length
            } in database.`
        );
        console.log(`Recovering additional games...`);
        const num_entries_not_found = await store_game_database();
        if (num_entries_not_found == 0) {
            console.log(`All games recovered.`);
        } else {
            console.log(
                `Incomplete database recovery - missing ${num_entries_not_found} records (currently have ${
                    Object.keys(game_database).length
                }). Rerun server to continue download.`
            );
        }
    }
    console.log(`Server running at http://${hostname}:${port}/`);
});

async function store_game_name_to_ids() {
    const fetch_response = await fetch(
        "https://api.steampowered.com/ISteamApps/GetAppList/v0002/?key=STEAMKEY&format=json"
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
    const game_list = JSON.parse(json_response).applist.apps;
    for (let i = 0; i < game_list.length; i++) {
        if (!filter_game_by_name(game_list[i].name)) {
            continue;
        }
        const simple_name = simplify_game_name_search_term(game_list[i].name);
        if (game_name_to_ids.get(simple_name) == undefined) {
            game_name_to_ids.set(simple_name, []);
        }
        game_name_to_ids.get(simple_name).push(game_list[i].appid);
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
    const map_keys = Array.from(game_name_to_ids.keys());
    let database = {};
    let entries_left = 0;
    keyLoop: for (let i = 0; i < limit; i++) {
        const relevant_ids = game_name_to_ids.get(map_keys[i]);
        for (let j = 0; j < relevant_ids.length; j++) {
            const target_game_id = relevant_ids[j];
            if (game_database[target_game_id]) {
                continue;
            }
            const steam_fetch_response = await fetch(
                "https://store.steampowered.com/api/appdetails?appids=" +
                    target_game_id
            ).catch(function (err) {
                console.log("Unable to fetch -", err);
            });
            const steam_json_response = await steam_fetch_response.text();
            const steam_object_response = JSON.parse(steam_json_response);
            if (!steam_object_response) {
                console.log(
                    "Steamworks API has stopped responding - rate limit reached."
                );
                entries_left = Array.from(game_name_to_ids.values())
                    .slice(i)
                    .reduce((partialSum, a) => partialSum + a.length, 0);
                break keyLoop;
            }
            let steam_only_info = {};
            if (!steam_object_response[target_game_id].success) {
                steam_only_info = {
                    available_in_aus: false,
                    year: "",
                    short_desc: "",
                    header_image: "",
                };
            } else {
                const steam_game_info =
                    steam_object_response[target_game_id].data;
                const year = steam_game_info.release_date.coming_soon
                    ? "Coming Soon"
                    : steam_game_info.release_date.date.split(" ").at(-1);
                const short_desc = steam_game_info.short_description;
                const header_image = steam_game_info.header_image;
                const price = steam_game_info.is_free
                    ? 0
                    : steam_game_info?.price_overview?.initial ?? "Coming Soon";
                steam_only_info = {
                    available_in_aus: true,
                    year,
                    short_desc,
                    header_image,
                    price,
                };
            }
            const steamspy_fetch_response = await fetch(
                "https://steamspy.com/api.php?request=appdetails&appid=" +
                    target_game_id
            ).catch(function (err) {
                console.log("Unable to fetch -", err);
            });
            const steamspy_json_response = await steamspy_fetch_response.text();
            const steamspy_game_info = JSON.parse(steamspy_json_response);
            const name = steamspy_game_info.name;
            const price = steamspy_game_info.price;
            const developers = steamspy_game_info.developer.split(",");
            const publishers = steamspy_game_info.publisher.split(",");
            const tag_names = steamspy_game_info.tags;
            const pos_reviews = steamspy_game_info.positive;
            const database_entry = {
                name,
                price,
                developers,
                publishers,
                tag_names,
                pos_reviews,
                ...steam_only_info,
            };
            database[target_game_id] = database_entry;
        }
    }
    database = { ...game_database, ...database };
    fs.writeFileSync(game_database_file, JSON.stringify(database), (err) => {
        if (err) {
            console.log("Unable to write -", err);
        }
    });
    return entries_left;
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
