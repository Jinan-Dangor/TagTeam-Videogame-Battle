import React, { useState } from "react";
import { GeneratePaletteColour, OkColourToString, StringToOkColour } from "../../utilities/ColourPalette";
import PaletteDisplay from "./PaletteDisplay";

interface IPalettePickerProps {
    height?: number;
    width?: number;
}

const PalettePicker = ({ height, width }: IPalettePickerProps) => {
    const [testColourHue, setTestColourHue] = useState(240);
    const testColourPalette = GeneratePaletteColour(StringToOkColour(`oklch(60% 30% ${testColourHue})`));

    return (
        <div className="palette-picker">
            <div>Palette Picker</div>
            <p>{testColourHue}</p>
            <input
                style={{ width: "300px" }}
                type="range"
                min="0"
                max="360"
                id="colourSlideTest"
                value={testColourHue}
                onChange={(e) => {
                    setTestColourHue(parseInt(e.target.value));
                }}
            ></input>
            <br />
            <PaletteDisplay title="" colours={Object.values(testColourPalette).map((key) => OkColourToString(key))} height={height} width={width} />
        </div>
    );
};

export default PalettePicker;
