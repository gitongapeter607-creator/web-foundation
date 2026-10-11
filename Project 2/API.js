// QuickNotes API client.
// Talks to the JSONPlaceholder practice API (a "posts" resource stands in for notes).

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const NOTE_LIMIT = 10;
const MAX_TITLE_LENGTH = 100;

const loadBtn = document.getElementById("load-btn");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const notesList = document.getElementById("notes-list");

// Notes currently shown on the page.
// Each one looks like { key, id, title, body, local }.
//  - key:   unique id used only by this page (JSONPlaceholder gives every
//           new note the same id, 101, so we cannot rely on id alone)
//  - local: true if the note was created in this page and never really
//           existed on the server (see deleteNote)
let notes = [];
let nextKey = 1;
let busy = false;

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

// type is "loading", "success" or "error"; style.css colours each one.
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = "status-" + type;
}

// Disables every button while a request is running.
function setBusy(isBusy) {
  busy = isBusy;
  loadBtn.disabled = isBusy;
  submitBtn.disabled = isBusy;
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.disabled = isBusy;
  });
}

function friendlyMessage(error, action) {
  if (error.status) {
    return (
      "Sorry, we could not " + action + ". The server answered with status " +
      error.status + ". Please try again."
    );
  }
  return (
    "Sorry, we could not " + action +
    ". Please check your internet connection and try again."
  );
}

function pluralNotes(count) {
  return count + (count === 1 ? " note" : " notes");
}

/* ---------------------------------------------------------
   Reusable request function
--------------------------------------------------------- */

// Calls fetch, checks response.ok and throws on any error.
// Returns { status, data } so callers can show the status code.
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error("Request failed with status " + response.status);
    error.status = response.status;
    throw error;
  }

  // Some responses (like DELETE) may have an empty body.
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return { status: response.status, data: data };
}

/* ---------------------------------------------------------
   Drawing the list (user text is only ever set with textContent)
--------------------------------------------------------- */

function createNoteItem(note) {
  const item = document.createElement("li");
  item.className = "note";

  const title = document.createElement("h3");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.disabled = busy;
  deleteBtn.addEventListener("click", () => deleteNote(note));

  item.append(title, body, deleteBtn);
  return item;
}

function renderNotes() {
  notesList.innerHTML = "";

  // Empty state
  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No notes to show. Click \"Load notes\" or add a new one.";
    notesList.appendChild(empty);
    return;
  }

  notes.forEach((note) => notesList.appendChild(createNoteItem(note)));
}

/* ---------------------------------------------------------
   GET: load notes
--------------------------------------------------------- */

async function loadNotes() {
  setBusy(true);
  setStatus("Loading notes...", "loading");

  try {
    const { data } = await request(API_URL + "?_limit=" + NOTE_LIMIT);

    // Replaces the list. Notes created in this page only exist in memory,
    // so they disappear on reload, just like the fake server forgets them.
    notes = data.map((note) => ({
      key: nextKey++,
      id: note.id,
      title: note.title,
      body: note.body,
      local: false,
    }));

    renderNotes();

    if (notes.length === 0) {
      setStatus("The server has no notes to show.", "success");
    } else {
      setStatus("Loaded " + pluralNotes(notes.length) + " from the server.", "success");
    }
  } catch (error) {
    setStatus(friendlyMessage(error, "load the notes"), "error");
  } finally {
    setBusy(false);
  }
}

/* ---------------------------------------------------------
   POST: create a note
--------------------------------------------------------- */

// Returns an error message, or "" if the title is fine.
function validateTitle(title) {
  if (title === "") {
    return "Please enter a title for your note.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return "The title must be " + MAX_TITLE_LENGTH + " characters or fewer (yours has " + title.length + ").";
  }
  return "";
}

async function createNote(title, body) {
  setBusy(true);
  setStatus("Creating note...", "loading");

  try {
    const { status, data } = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, body: body, userId: 1 }),
    });

    // Newest note goes at the top of the list.
    notes.unshift({
      key: nextKey++,
      id: data.id,
      title: data.title,
      body: data.body,
      local: true,
    });
    renderNotes();

    // Clear the form only after success, so a failed request does not lose the user's text.
    noteForm.reset();

    setStatus("Note created (status " + status + ", id " + data.id + ").", "success");
  } catch (error) {
    setStatus(friendlyMessage(error, "create the note"), "error");
  } finally {
    setBusy(false);
  }
}

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  const problem = validateTitle(title);
  if (problem) {
    setStatus(problem, "error");
    titleInput.focus();
    return;
  }

  createNote(title, body);
});

/* ---------------------------------------------------------
   DELETE: remove a note
--------------------------------------------------------- */

// JSONPlaceholder is a fake API: it accepts POST and DELETE requests and
// answers as if they worked, but it never saves anything. That causes two things:
//  1. A note we created with POST was never stored, so the server has nothing
//     to delete. For those local notes we skip the request and only remove
//     the note from the page.
//  2. A note loaded from the server is deleted with a real DELETE request, and we
//     remove it from the page when the server answers OK. Because nothing is
//     really deleted, clicking "Load notes" again brings it back.
// A real API would delete the note on the server and it would stay gone.
async function deleteNote(note) {
  setBusy(true);
  setStatus("Deleting note...", "loading");

  try {
    let message;

    if (note.local) {
      message = "Note removed. It only existed in this page, so no request was needed.";
    } else {
      const { status } = await request(API_URL + "/" + note.id, { method: "DELETE" });
      message = "Note " + note.id + " deleted (status " + status + ").";
    }

    notes = notes.filter((n) => n.key !== note.key);
    renderNotes();
    setStatus(message, "success");
  } catch (error) {
    setStatus(friendlyMessage(error, "delete the note"), "error");
  } finally {
    setBusy(false);
  }
}

/* ---------------------------------------------------------
   Start
--------------------------------------------------------- */

loadBtn.addEventListener("click", loadNotes);
renderNotes(); // shows the empty state before anything is loaded