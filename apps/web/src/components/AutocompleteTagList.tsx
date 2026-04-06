import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AutocompleteTagListProps = {
  title: string;
  description: string;
  items: string[];
  suggestions: string[];
  placeholder: string;
  emptyText: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
};

export function AutocompleteTagList({
  title,
  description,
  items,
  suggestions,
  placeholder,
  emptyText,
  onAdd,
  onRemove
}: AutocompleteTagListProps) {
  const [draftValue, setDraftValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on current input, excluding already-added items
  const filteredSuggestions = useMemo(() => {
    if (!draftValue.trim()) {
      return [];
    }

    const query = draftValue.toLowerCase();
    return suggestions
      .filter(
        (suggestion) =>
          suggestion.toLowerCase().includes(query) && !items.includes(suggestion)
      )
      .slice(0, 8); // Limit to 8 suggestions
  }, [draftValue, suggestions, items]);

  const commitValue = (value?: string) => {
    const nextValue = (value ?? draftValue).trim();
    if (!nextValue || items.includes(nextValue)) {
      return;
    }

    onAdd(nextValue);
    setDraftValue("");
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && event.key !== "Enter") {
      return;
    }

    switch (event.key) {
      case "Enter": {
        event.preventDefault();
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          commitValue(filteredSuggestions[selectedIndex]);
        } else {
          commitValue();
        }
        break;
      }
      case "ArrowDown": {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredSuggestions.length - 1
            ? prev + 1
            : filteredSuggestions.length - 1
        );
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      }
      case "Escape": {
        event.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      }
    }
  };

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const suggestions2 = listRef.current.querySelectorAll("[data-suggestion-item]");
      const selected = suggestions2[selectedIndex];
      if (selected) {
        selected.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="autocomplete-tag-list" ref={containerRef}>
      <div className="grid gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="autocomplete-tag-list__chips" aria-label={title}>
        {items.length ? (
          items.map((item) => (
            <button
              key={item}
              type="button"
              className="autocomplete-tag-list__chip"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${title.toLowerCase()} tag ${item}`}
            >
              <span className="autocomplete-tag-list__chip-label">{item}</span>
              <X data-icon="inline-end" />
            </button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </div>

      <div className="autocomplete-tag-list__editor">
        <div className="autocomplete-tag-list__input-wrapper">
          <Input
            value={draftValue}
            onChange={(event) => {
              setDraftValue(event.currentTarget.value);
              setIsOpen(true);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => draftValue && setIsOpen(true)}
            placeholder={placeholder}
            aria-label={`Add ${title.toLowerCase()}`}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={`${title}-suggestions`}
          />

          {isOpen && filteredSuggestions.length > 0 && (
            <div
              className="autocomplete-tag-list__suggestions"
              id={`${title}-suggestions`}
              role="listbox"
              ref={listRef}
            >
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  data-suggestion-item
                  className={`autocomplete-tag-list__suggestion ${
                    selectedIndex === index
                      ? "autocomplete-tag-list__suggestion--selected"
                      : ""
                  }`}
                  onClick={() => commitValue(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => commitValue()}
          disabled={!draftValue.trim() || items.includes(draftValue.trim())}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
