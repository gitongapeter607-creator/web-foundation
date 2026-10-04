let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" }
];

function searchNotes(word) {
  return notes.filter(n => n.text.toLowerCase().includes(word.toLowerCase()));
}

function longestNote() {
  if (notes.length === 0) return null;
  return notes.reduce((a, b) => a.text.length > b.text.length ? a : b);
}

function countByCategory() {
  return notes.reduce((c, n) => {
    c[n.category]++;
    return c;
  }, { personal: 0, work: 0, study: 0 });
}

function getSummary() {
  let c = countByCategory();
  return `${notes.length} notes: ${c.personal} personal, ${c.work} work, ${c.study} study.`;
}

function isDuplicate(text) {
  let clean = text.trim().replace(/\s+/g, " ").toLowerCase();
  return notes.some(n => n.text.trim().replace(/\s+/g, " ").toLowerCase() === clean);
}

function addNote(text, category) {
  if (text.length < 1 || text.length > 200) {
    console.log("Invalid length");
    return false;
  }

  if (isDuplicate(text)) {
    console.log("Duplicate note");
    return false;
  }

  if (!["personal", "work", "study"].includes(category)) {
    console.log("Invalid category");
    return false;
  }

  let id = notes.length ? Math.max(...notes.map(n => n.id)) + 1 : 1;
  notes.push({ id, text, category });
  console.log("Note added");
  return true;
}

console.log(searchNotes("day"));
console.log(longestNote());
console.log(countByCategory());
console.log(getSummary());
console.log(isDuplicate("  CALL   MUM  "));
console.log(addNote("Buy a new laptop", "personal"));
console.log(addNote("BUY A NEW LAPTOP", "personal"));
console.log(addNote("Learn Python", "coding"));
console.log(notes);
