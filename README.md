# TagTeam Videogame Battle

Inspired by Cine2Nerdle's battle mode, travel between Steam games based on developer, publisher and tags!

Documentation is still being worked on, but in the meantime here's where you can find the following:
<br>
**Scraped List of Tags**
<br>
`my-app/src/scripts/scrapedTags.json`
<br>
**Game IDs, by Simplified Name of App**
<br>
`server/game_name_to_ids.json`
<br>
**App IDs that Experienced Errors During Retrieval**
<br>
`server/skipped_ids.json`
<br>
**Database of Games**
<br>
`server/game_database.json`
<br>

# Playing the Game Offline

Run the game server by running the following in the `/server/` directory:
<br>
`node tagteam-server.js`
<br><br>
Then running the following in the `/my-app/src/` directory:
<br>
`npm start`
<br>

# Setup

If you haven't already, you'll need to [install node.js and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).
<br><br>
`npm start` will run the game, but to properly host it locally run `npm install -g serve` then run the following from the `/my-app/` directory:
<br>
`serve -s build`
<br>
(This will launch much faster)
