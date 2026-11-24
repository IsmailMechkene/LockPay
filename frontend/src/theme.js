// Colour theme: "auto" follows the OS, "light" is a high-contrast palette
// meant for weak projectors, "dark" forces the dark palette.
// index.html applies the saved choice before first paint (no flash); this
// module only handles changes made with the switch in the top bar.

const STORAGE_KEY = "lockpay.theme";
const THEMES = ["auto", "light", "dark"];

function initialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  return "auto";
}

let theme = initialTheme();

export const getTheme = () => theme;

export function setTheme(next) {
  if (!THEMES.includes(next)) return;
  theme = next;
  applyTheme();
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked */ }
}

function applyTheme() {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = theme;
}

applyTheme();
