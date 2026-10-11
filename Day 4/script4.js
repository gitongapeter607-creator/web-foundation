const note = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeBtn = document.querySelector("#theme-toggle");

const LIMIT = 200;
const WARN_AT = 180;
const DRAFT_KEY = "note-draft";
const THEME_KEY = "note-theme";

function updateCounts() {
  const text = note.value;
  const chars = text.length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  charCount.textContent = `${chars} / ${LIMIT} characters`;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;

  charCount.classList.toggle("warning", chars > WARN_AT && chars <= LIMIT);
  charCount.classList.toggle("over", chars > LIMIT);
}

function clearAll() {
  note.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  note.focus();
}

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  themeBtn.textContent = dark ? "Light mode" : "Dark mode";
}

note.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(DRAFT_KEY, note.value);
});

note.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    clearAll();
  }
});

clearBtn.addEventListener("click", clearAll);

themeBtn.addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark");
  applyTheme(dark);
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
});

// On load: restore draft and theme
note.value = localStorage.getItem(DRAFT_KEY) || "";
applyTheme(localStorage.getItem(THEME_KEY) === "dark");
updateCounts();