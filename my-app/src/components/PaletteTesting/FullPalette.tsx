import React from "react";
import PaletteDisplay from "./PaletteDisplay";

interface IFullPaletteProps {}

const FullPalette = ({}: IFullPaletteProps) => {
    return (
        <div className="full-palette">
            <PaletteDisplay
                title={"Primary"}
                colours={["var(--primary-black)", "var(--primary-darkest)", "var(--primary-dark)", "var(--primary-mid)", "var(--primary-light)", "var(--primary-lightest)", "var(--primary-white)"]}
            />
            <PaletteDisplay
                title={"Secondary"}
                colours={[
                    "var(--secondary-black)",
                    "var(--secondary-darkest)",
                    "var(--secondary-dark)",
                    "var(--secondary-mid)",
                    "var(--secondary-light)",
                    "var(--secondary-lightest)",
                    "var(--secondary-white)",
                ]}
            />
            <PaletteDisplay
                title={"Tertiary"}
                colours={[
                    "var(--tertiary-black)",
                    "var(--tertiary-darkest)",
                    "var(--tertiary-dark)",
                    "var(--tertiary-mid)",
                    "var(--tertiary-light)",
                    "var(--tertiary-lightest)",
                    "var(--tertiary-white)",
                ]}
            />
            <PaletteDisplay
                title={"Neutral"}
                colours={["var(--neutral-black)", "var(--neutral-darkest)", "var(--neutral-dark)", "var(--neutral-mid)", "var(--neutral-light)", "var(--neutral-lightest)", "var(--neutral-white)"]}
            />
        </div>
    );
};

export default FullPalette;
