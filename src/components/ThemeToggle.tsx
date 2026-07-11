import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Hell/Dunkel-Umschalter. Schaltet `.dark` auf `document.documentElement` und
 * persistiert die Wahl in `localStorage.theme`. Der Initialzustand wird beim
 * Mount aus dem DOM gelesen (nicht aus SSR-State), da der Server den vom
 * No-Flash-Script im `<head>` gesetzten Modus nicht kennt — sonst Hydration-Mismatch.
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    // Bewusst im Effect (nicht im State-Initializer): liest den vom No-Flash-Script
    // gesetzten Modus erst nach der Hydration, sonst SSR/Client-Mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
