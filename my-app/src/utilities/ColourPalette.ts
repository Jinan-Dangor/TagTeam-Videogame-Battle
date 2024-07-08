export type ColourPalette = {
    primary: PaletteColour;
    secondary: PaletteColour;
    tertiary: PaletteColour;
    neutral: PaletteColour;
};

export type PaletteColour = {
    black: OkColour;
    darkest: OkColour;
    dark: OkColour;
    mid: OkColour;
    light: OkColour;
    lightest: OkColour;
    white: OkColour;
};

export type OkColour = {
    L: number;
    C: number;
    H: number;
    A?: number;
};

const nonrandomColours = [`oklch(60% 30% 250)`, `oklch(60% 30% 120)`, `oklch(60% 30% 100)`];
const randomizedColours = shuffle(nonrandomColours);
const coloursToUse = nonrandomColours;

const currentPalette = {
    primary: GeneratePaletteColour(StringToOkColour(coloursToUse[0])),
    secondary: GeneratePaletteColour(StringToOkColour(coloursToUse[1])),
    tertiary: GeneratePaletteColour(StringToOkColour(coloursToUse[2])),
    neutral: GenerateNeutralPaletteColour(StringToOkColour(coloursToUse[0])),
};

function shuffle<T>(t: T[]) {
    const newT = [...t];
    const length = newT.length;
    for (let i = 0; i < length - 1; i++) {
        const j = Math.floor(Math.random() * (length - i)) + i;
        const temp = newT[i];
        newT[i] = newT[j];
        newT[j] = temp;
    }
    return newT;
}

const cssPrimaryMap: { [id: string]: string } = {
    "primary-black": OkColourToString(currentPalette.primary.black),
    "primary-darkest": OkColourToString(currentPalette.primary.darkest),
    "primary-dark": OkColourToString(currentPalette.primary.dark),
    "primary-mid": OkColourToString(currentPalette.primary.mid),
    "primary-light": OkColourToString(currentPalette.primary.light),
    "primary-lightest": OkColourToString(currentPalette.primary.lightest),
    "primary-white": OkColourToString(currentPalette.primary.white),
};

const cssSecondaryMap: { [id: string]: string } = {
    "secondary-black": OkColourToString(currentPalette.secondary.black),
    "secondary-darkest": OkColourToString(currentPalette.secondary.darkest),
    "secondary-dark": OkColourToString(currentPalette.secondary.dark),
    "secondary-mid": OkColourToString(currentPalette.secondary.mid),
    "secondary-light": OkColourToString(currentPalette.secondary.light),
    "secondary-lightest": OkColourToString(currentPalette.secondary.lightest),
    "secondary-white": OkColourToString(currentPalette.secondary.white),
};

const cssTertiaryMap: { [id: string]: string } = {
    "tertiary-black": OkColourToString(currentPalette.tertiary.black),
    "tertiary-darkest": OkColourToString(currentPalette.tertiary.darkest),
    "tertiary-dark": OkColourToString(currentPalette.tertiary.dark),
    "tertiary-mid": OkColourToString(currentPalette.tertiary.mid),
    "tertiary-light": OkColourToString(currentPalette.tertiary.light),
    "tertiary-lightest": OkColourToString(currentPalette.tertiary.lightest),
    "tertiary-white": OkColourToString(currentPalette.tertiary.white),
};

const cssNeutralMap: { [id: string]: string } = {
    "neutral-black": OkColourToString(currentPalette.neutral.black),
    "neutral-darkest": OkColourToString(currentPalette.neutral.darkest),
    "neutral-dark": OkColourToString(currentPalette.neutral.dark),
    "neutral-mid": OkColourToString(currentPalette.neutral.mid),
    "neutral-light": OkColourToString(currentPalette.neutral.light),
    "neutral-lightest": OkColourToString(currentPalette.neutral.lightest),
    "neutral-white": OkColourToString(currentPalette.neutral.white),
};

const cssPaletteMap: { [id: string]: string } = {
    ...cssPrimaryMap,
    ...cssSecondaryMap,
    ...cssTertiaryMap,
    ...cssNeutralMap,
};

const root = document.querySelector(":root") as HTMLElement;

export function initializePalette() {
    applyPaletteMap(cssPaletteMap);
}

export function applyPaletteMap(paletteMap: { [id: string]: string }) {
    Object.keys(paletteMap).forEach((key) => {
        root?.style.setProperty(`--${key}`, cssPaletteMap[key]);
    });
}

export function OkColourToString(c: OkColour): string {
    if (c.L < 0 || c.L > 100) {
        console.error(`Invalid lightness ${c.L} provided to oklch() colour`);
        return ``;
    } else if (c.C < 0 || c.C > 100) {
        console.error(`Invalid chroma ${c.C} provided to oklch() colour`);
        return ``;
    } else if (c.H < 0 || c.H > 360) {
        console.error(`Invalid hue ${c.H} provided to oklch() colour`);
        return ``;
    }
    if (c.A) {
        if (c.A < 0 || c.A > 100) {
            console.error(`Invalid alpha ${c.A} provided to oklch() colour`);
            return ``;
        }
        return `oklch(${c.L}% ${c.C}% ${c.H} ${c.A}%)`;
    }
    return `oklch(${c.L}% ${c.C}% ${c.H})`;
}

export function StringToOkColour(s: string): OkColour {
    const hasAlpha = s.split(" ").length > 3;
    if (hasAlpha) {
        const matches = /oklch\((\d+(\.\d+)?)% (\d+(\.\d+)?)% (\d+(\.\d+)?) (\d+(\.\d+)?)%\)/.exec(s);
        if (matches !== null) {
            return { L: parseInt(matches[1]), C: parseInt(matches[3]), H: parseInt(matches[5]), A: parseInt(matches[7]) };
        } else {
            console.error(`Attempted to parse invalid colour ${s} into okColour.`);
            return { L: 0, C: 0, H: 0 };
        }
    }
    const matches = /oklch\((\d+(\.\d+)?)% (\d+(\.\d+)?)% (\d+(\.\d+)?)\)/.exec(s);
    if (matches !== null) {
        return { L: parseInt(matches[1]), C: parseInt(matches[3]), H: parseInt(matches[5]) };
    } else {
        console.error(`Attempted to parse invalid colour ${s} into okColour.`);
        return { L: 0, C: 0, H: 0 };
    }
}

export function GeneratePaletteColour(colour: OkColour): PaletteColour {
    const NUM_COLOURS = 7;
    const LOWEST_LIGHTNESS = 10;
    const HIGHEST_LIGHTNESS = 90;
    const LIGHTNESS_STEP = (HIGHEST_LIGHTNESS - LOWEST_LIGHTNESS) / (NUM_COLOURS - 1);
    const LOWEST_CHROMA = 20;
    const HIGHEST_CHROMA = 40;
    const CHROMA_STEP = (HIGHEST_CHROMA - LOWEST_CHROMA) / ((NUM_COLOURS - 1) / 2);
    const newPaletteColour = {
        black: { ...colour, L: LOWEST_LIGHTNESS, C: LOWEST_CHROMA },
        darkest: { ...colour, L: LOWEST_LIGHTNESS + LIGHTNESS_STEP * 1, C: LOWEST_CHROMA + CHROMA_STEP * 1 },
        dark: { ...colour, L: LOWEST_LIGHTNESS + LIGHTNESS_STEP * 2, C: LOWEST_CHROMA + CHROMA_STEP * 2 },
        mid: { ...colour, L: LOWEST_LIGHTNESS + LIGHTNESS_STEP * 3, C: LOWEST_CHROMA + CHROMA_STEP * 3 },
        light: { ...colour, L: LOWEST_LIGHTNESS + LIGHTNESS_STEP * 4, C: LOWEST_CHROMA + CHROMA_STEP * 2 },
        lightest: { ...colour, L: LOWEST_LIGHTNESS + LIGHTNESS_STEP * 5, C: LOWEST_CHROMA + CHROMA_STEP * 1 },
        white: { ...colour, L: HIGHEST_LIGHTNESS, C: LOWEST_CHROMA },
    };
    return newPaletteColour;
}

export function GenerateNeutralPaletteColour(colour: OkColour): PaletteColour {
    const newPaletteColour = GeneratePaletteColour(colour);
    Object.keys(newPaletteColour).forEach((key) => {
        newPaletteColour[key].C /= 5;
    });
    return newPaletteColour;
}
