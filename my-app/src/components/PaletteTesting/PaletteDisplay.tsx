import React from "react";

interface IPaletteDisplayProps {
    title: string;
    colours: string[];
    height?: number;
    width?: number;
}

const PaletteDisplay = ({ title, colours, height = 50, width = height * colours.length }: IPaletteDisplayProps) => {
    return (
        <div className="palette-display">
            <div>{title}</div>
            <div style={{ display: "inline-block" }}>
                {colours.map((colour) => {
                    return <div style={{ backgroundColor: colour, height: `${height}px`, width: `${width / colours.length}px`, display: "inline-block" }}></div>;
                })}
            </div>
        </div>
    );
};

export default PaletteDisplay;
