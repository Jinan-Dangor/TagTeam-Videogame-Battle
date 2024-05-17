import React, { useEffect, useState } from "react";

interface IAutocompleteInputProps {
    value: string;
    setValue: (value: string) => void;
    suggestions: Suggestion[];
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSelectSuggestion: (value: string) => void;
}

type Suggestion = {
    label: string;
    search_term: string;
    value: string;
};

const AutocompleteInput = ({
    value,
    setValue,
    suggestions,
    onChange,
    onSelectSuggestion,
}: IAutocompleteInputProps) => {
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const suggestionbackgroundColour = "#c4c4c4";
    const suggestionHoverColour = "#a4a4a4";
    const suggestionBorderColour = "#949494";

    return (
        <span
            style={{
                position: "relative",
                display: "inline-block",
            }}
        >
            <input
                value={value}
                onChange={(e) => {
                    onChange(e);
                    setShowSuggestions(true);
                }}
                onFocus={(e) => {
                    if (value != "") {
                        setShowSuggestions(true);
                    }
                }}
                onBlur={async (e) => {
                    await new Promise((r) => setTimeout(r, 1000));
                    setShowSuggestions(false);
                }}
            />
            {showSuggestions && (
                <div
                    style={{
                        position: "absolute",
                        backgroundColor: suggestionbackgroundColour,
                        border: `1px solid ${suggestionBorderColour}`,
                    }}
                >
                    {suggestions.map((suggestion) => {
                        return (
                            <div
                                id={suggestion.value}
                                style={{
                                    border: `1px solid ${suggestionBorderColour}`,
                                }}
                                onClick={() => {
                                    setValue(suggestion.value);
                                    onSelectSuggestion(suggestion.search_term);
                                    setShowSuggestions(false);
                                }}
                            >
                                {suggestion.label}
                            </div>
                        );
                    })}
                </div>
            )}
        </span>
    );
};

export default AutocompleteInput;
