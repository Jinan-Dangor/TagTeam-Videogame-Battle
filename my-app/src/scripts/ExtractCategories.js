DownloadTags();

async function DownloadTags() {
    const fs = require("node:fs");
    const path = require("path");
    const sourceFilePath = path.join(
        __dirname,
        "Steam Game Tags · SteamDB.html"
    );
    const destFilePath = path.join(__dirname, "scrapedTags.json");
    fs.readFile(sourceFilePath, { encoding: "utf-8" }, (err, data) => {
        if (!err) {
            const regex =
                /<a class="btn btn-outline tag-color-[^"]*" href="[^"]*"><span aria-hidden="true">[^<]*<\/span>[^<]*<\/a>/g;
            const matches = data.match(regex);
            const tags = matches.map((str) => {
                const tagID = str.match(/(?<=\/tag\/)[^/]*/g)[0];
                const tagName = str.match(/(?<=<\/span>)[^<]*/g)[0];
                const tagEmoji = str.match(/(?<=">)[^<]*/g)[1].slice(0, -1);
                return { ID: tagID, name: tagName, emoji: tagEmoji };
            });
            fs.writeFile(destFilePath, JSON.stringify(tags), (err) => {
                if (err) {
                    console.log(err);
                }
            });
        } else {
            console.log(err);
        }
    });
}
