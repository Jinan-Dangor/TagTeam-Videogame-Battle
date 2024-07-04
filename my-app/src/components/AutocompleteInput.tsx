import React, { useEffect, useState } from "react";

interface IAutocompleteInputProps {
    placeholder?: string;
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

const AutocompleteInput = ({ placeholder = "", value, setValue, suggestions, onChange, onSelectSuggestion }: IAutocompleteInputProps) => {
    const [shouldKeepSuggestionsOpen, setShouldKeepSuggestionsOpen] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const suggestionBackgroundColour = "#c4c4c4";
    const suggestionHoverColour = "#a4a4a4";
    const suggestionBorderColour = "#949494";

    useEffect(() => {
        if (!shouldKeepSuggestionsOpen && showSuggestions) {
            setShowSuggestions(false);
        }
    }, [shouldKeepSuggestionsOpen]);

    return (
        <span
            style={{
                position: "relative",
                display: "inline-block",
            }}
        >
            <input
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                    onChange(e);
                    if (e.target.value === "") {
                        setShowSuggestions(false);
                    } else {
                        setShowSuggestions(true);
                    }
                }}
                onFocus={(e) => {
                    if (value != "") {
                        setShowSuggestions(true);
                    }
                }}
            />
            {showSuggestions && (
                <div
                    style={{
                        position: "absolute",
                        backgroundColor: suggestionBackgroundColour,
                        border: `1px solid ${suggestionBorderColour}`,
                        zIndex: "1",
                    }}
                    onMouseEnter={() => setShouldKeepSuggestionsOpen(true)}
                    onMouseLeave={() => setShouldKeepSuggestionsOpen(false)}
                >
                    {suggestions.map((suggestion) => {
                        return (
                            <div
                                key={suggestion.value}
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
