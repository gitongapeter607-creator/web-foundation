let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];
 
const CATEGORIES = ["personal", "work", "study"];

function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(search));
}
function longestNote() {
  if (notes.length === 0) return null;
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}
function countByCategory() {
  const counts = { personal: 0, work: 0, study: 0 };
  notes.forEach((note) => {
    counts[note.category]++;
  });
  return counts;
}
function getSummary() {
  const counts = countByCategory();
  const word = notes.length === 1 ? "note" : "notes";
  return (
    `${notes.length} ${word}: ` +
    `${counts.personal} personal, ${counts.work} work, ${counts.study} study.`
  );
}
function isDuplicate(text) {
  const cleaned = text.trim().toLowerCase();
  return notes.some((note) => note.text.toLowerCase() === cleaned);
}
function addNote(text, category) {
  const cleaned = text.trim();
 
  if (cleaned.length === 0 || cleaned.length > 200) {
    console.log("Rejected: a note must be 1-200 characters.");
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log(`Rejected: "${cleaned}" already exists.`);
    return false;
  }
  if (!CATEGORIES.includes(category)) {
    console.log(`Rejected: "${category}" is not a valid category.`);
    return false;
  }
 
  notes.push({ id: Date.now(), text: cleaned, category: category });
  console.log(`Added: "${cleaned}" (${category})`);
  return true;
}
console.log(searchNotes("revise"));
console.log(searchNotes("BREAD"));
console.log(searchNotes("holiday"));
 
console.log(longestNote().text);
 
console.log(countByCategory());
console.log(getSummary());
 
console.log(isDuplicate("  call MUM "));
console.log(isDuplicate("Call dad"));
 
console.log(addNote("Read chapter 4", "study"));
console.log(addNote("call mum", "personal"));
console.log(addNote("   ", "work"));
console.log(addNote("Plan trip", "holiday"));
console.log(getSummary());