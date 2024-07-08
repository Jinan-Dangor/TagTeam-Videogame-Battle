import React from "react";
import "./App.css";
import "./styles/ColourPaletteVariables.css";
import GameScreen from "./components/GameScreen";

function App() {
    return (
        <div className="App" style={{ minHeight: "100vh", backgroundColor: "var(--background)", color: "var(--text)" }}>
            <GameScreen />
        </div>
    );
}

export default App;
