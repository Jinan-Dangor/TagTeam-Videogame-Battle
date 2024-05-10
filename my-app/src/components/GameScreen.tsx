import React, { useState } from "react";
import tags from "../scripts/scrapedTags.json";

function GameScreen() {
    const [gameData, setGameData] = useState<any>(null);
    const gameID = 440;

    return (
        <div className="App">
            {gameData && <p>You chose the game {}</p>}
            {tags.map((tag) => (
                <p>
                    {tag.name} {tag.emoji}
                </p>
            ))}
        </div>
    );
}

export default GameScreen;
