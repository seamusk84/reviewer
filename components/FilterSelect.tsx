import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  label: string;
  options: string[];
  value: string; // selected value
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string; // optional wrapper class
};

export default function FilterSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Start typing…",
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Clear the filter whenever we open the menu
  function openList() {
    setQuery("");
    setOpen(true);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={rootRef} className={className} style={{ position: "relative", minWidth: 320 }}>
      <label style={{ display: "block", marginBottom: 6 }}>{label}</label>

      <div style={{ position: "relative" }}>
        <input
          type="text"
          disabled={disabled}
          placeholder={value ? value : placeholder}
          value={query} // query is separate from the selected value
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) openList(); // show full list on focus
          }}
          autoComplete="off"
          style={{ width: "100%", paddingRight: 36 }}
        />

        <button
          type="button"
          aria-label={open ? "Hide options" : "Show all options"}
          disabled={disabled}
          onClick={() => {
            if (open) setOpen(false);
            else openList(); // opening clears the filter so the full list shows
          }}
          style={{
            position: "absolute",
            right: 6,
            top: 6,
            border: "none",
            background: "transparent",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: 6,
          }}
        >
          ▾
        </button>
      </div>

      {open && !disabled && (
        <ul
          style={{
            position: "absolute",
            zIndex: 20,
            marginTop: 4,
            maxHeight: 240,
            overflowY: "auto",
            width: "100%",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            listStyle: "none",
            padding: 0,
          }}
        >
          {filtered.length ? (
            filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt); // update selection
                    setQuery("");  // clear filter after choosing
                    setOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    background: "white",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseDown={(e) => e.preventDefault()} // prevents input blur before click
                >
                  {opt}
                </button>
              </li>
            ))
          ) : (
            <li style={{ padding: "8px 12px", color: "#666" }}>No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}
