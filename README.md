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

You can currently play the game by running the following in the `/server/` directory:
<br>
`node tagteam-server.js`
<br><br>
Then running the following in the `/my-app/src/` directory.
<br>
`npm start`
<br><br>
You can play this with other players in person or over a screen-shared voice call (you're effectively playing a "couch multiplayer" version of the game).
