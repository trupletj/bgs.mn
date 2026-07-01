"use client";

import * as React from "react";
import { Phone, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchUsers, type UserSearchResult } from "@/actions/users";
import { cn } from "@/lib/utils";

export interface UserSearchPickerProps {
  /** Placeholder for the input. */
  placeholder?: string;
  /** User ids to exclude from the results. */
  excludeIds?: string[];
  /** Callback when the user clicks a result. Input is cleared afterwards. */
  onSelect: (user: UserSearchResult) => void;
  /** Disable the input (e.g. during a submit). */
  disabled?: boolean;
  /** Additional className for the wrapper. */
  className?: string;
  /** Maximum results to display. */
  limit?: number;
  /** Auto-focus the input on mount. */
  autoFocus?: boolean;
  /** Custom search function (defaults to the global `searchUsers`). */
  searchFn?: (query: string, limit: number) => Promise<UserSearchResult[]>;
}

/**
 * Reusable, debounced user search picker.
 *
 * - Hits centralized `actions/users.searchUsers` (multi-field, multi-word).
 * - Keeps a fresh request id so older debounced responses don't overwrite newer ones.
 * - Closes dropdown on outside click + Escape.
 */
export function UserSearchPicker({
  placeholder = "Хүн хайх...",
  excludeIds,
  onSelect,
  disabled,
  className,
  limit = 12,
  autoFocus,
  searchFn = searchUsers,
}: UserSearchPickerProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<UserSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const reqIdRef = React.useRef(0);

  const excludeKey = (excludeIds ?? []).join(",");

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myReq = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      const data = await searchFn(trimmed, limit + (excludeIds?.length ?? 0));
      if (myReq !== reqIdRef.current) return;
      const exclude = new Set(excludeIds ?? []);
      const filtered = data.filter((u) => !exclude.has(u.id)).slice(0, limit);
      setResults(filtered);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, excludeKey, limit]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleSelect = (u: UserSearchResult) => {
    onSelect(u);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        disabled={disabled}
        className="pl-9"
      />
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {loading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-center text-xs text-muted-foreground">
              «{query.trim()}» хайлтад тохирох ажилтан олдсонгүй
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((u) => {
                const initials =
                  ((u.last_name?.[0] ?? "") + (u.first_name?.[0] ?? "")) || "?";
                const meta = [u.position_name, u.department_name]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(u)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {u.last_name} {u.first_name}
                        </p>
                        <p className="flex items-center gap-2 truncate text-[11px] text-muted-foreground">
                          {meta && <span className="truncate">{meta}</span>}
                          {u.phone && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3" />
                              {u.phone}
                            </span>
                          )}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-primary opacity-60" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
