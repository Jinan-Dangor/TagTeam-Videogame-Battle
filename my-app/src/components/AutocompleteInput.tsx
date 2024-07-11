import React, { useEffect, useState } from "react";
import "../styles/AutocompleteInput.css";

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

const TIME_UNTIL_CLOSE_AFTER_LEAVE_MS = 1000;
const TIME_UNTIL_CLOSE_AFTER_INACTIVE_MS = 5000;

const AutocompleteInput = ({ placeholder = "", value, setValue, suggestions, onChange, onSelectSuggestion }: IAutocompleteInputProps) => {
    const [shouldKeepSuggestionsOpen, setShouldKeepSuggestionsOpen] = useState(false);
    const [leaveTimeoutId, setLeaveTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [inactiveTimeoutId, setInactiveTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

    useEffect(() => {
        if (!shouldKeepSuggestionsOpen && showSuggestions) {
            setShowSuggestions(false);
        }
    }, [shouldKeepSuggestionsOpen]);

    const resetInactiveTimer = () => {
        if (inactiveTimeoutId) {
            clearTimeout(inactiveTimeoutId);
        }
        setInactiveTimeoutId(
            setTimeout(() => {
                setShouldKeepSuggestionsOpen(false);
            }, TIME_UNTIL_CLOSE_AFTER_INACTIVE_MS)
        );
    };

    return (
        <span className="autocomplete-input">
            <input
                className="input-text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                    onChange(e);
                    setValue("");
                    if (e.target.value === "") {
                        setShowSuggestions(false);
                    } else {
                        resetInactiveTimer();
                        setShouldKeepSuggestionsOpen(true);
                        setShowSuggestions(true);
                    }
                }}
                onFocus={(e) => {
                    if (value != "") {
                        resetInactiveTimer();
                        setShouldKeepSuggestionsOpen(true);
                        setShowSuggestions(true);
                    }
                }}
            />
            {showSuggestions && (
                <div
                    className="suggestions"
                    onMouseEnter={() => {
                        resetInactiveTimer();
                        setShouldKeepSuggestionsOpen(true);
                        if (leaveTimeoutId) {
                            clearTimeout(leaveTimeoutId);
                            setLeaveTimeoutId(null);
                        }
                    }}
                    onMouseLeave={() => {
                        setLeaveTimeoutId(
                            setTimeout(() => {
                                setShouldKeepSuggestionsOpen(false);
                            }, TIME_UNTIL_CLOSE_AFTER_LEAVE_MS)
                        );
                    }}
                >
                    {suggestions.map((suggestion) => {
                        return (
                            <div
                                key={suggestion.value}
                                id={suggestion.value}
                                className="suggestion"
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
