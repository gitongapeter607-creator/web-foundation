# QuickNotes System Design

QuickNotes is a notes app that is moving from a browser-only app to an online service for 1 million users. This project has two parts:

1. **An API client** (`index.html`, `api.js`, `style.css`) that proves the front end can talk to a REST API. It uses the JSONPlaceholder practice API to load, create and delete notes.
2. **Design documents** for the real QuickNotes backend, covering the API, the database and the overall architecture.

## How to run the API client

1. Download or clone this repository.
2. Open `index.html` in a web browser (double-click it). You need an internet connection because it calls `https://jsonplaceholder.typicode.com`.
3. Optional: serve the folder locally instead, for example with `python -m http.server`, then open `http://localhost:8000`.

What you can do on the page:

- **Load notes:** click "Load notes" to fetch 10 notes with a GET request.
- **Create a note:** fill in the title (required, up to 100 characters) and an optional body, then click "Add note". It is sent with a POST request and added to the top of the list.
- **Delete a note:** click "Delete" on a note to send a DELETE request and remove it from the list.

The page shows loading, success, error and empty messages, and the buttons are disabled while a request is running.

**Note:** JSONPlaceholder is a fake API and does not really save changes. Notes created on the page only exist until the page is reloaded, and a deleted note comes back when you click "Load notes" again. The comment above `deleteNote()` in `api.js` explains how the client handles this.

## Design documents

- [API design](docs/api-design.md): REST endpoints, request and response examples, and error codes.
- [Data model](docs/data-model.md): tables, keys, relationships, SQL, indexes, and the SQL vs NoSQL decision.
- [Architecture](docs/architecture.md): requirements, load estimates, the architecture diagram, request flows, trade-offs and single points of failure.

## Project files

```
quicknotes-system-design/
├── index.html
├── api.js
├── style.css
├── README.md
└── docs/
    ├── api-design.md
    ├── data-model.md
    └── architecture.md
```

## What I learned

- **One request function keeps error handling consistent.** Putting `fetch`, the `response.ok` check and the error throwing in a single `request()` function meant GET, POST and DELETE all handled errors in the same way, and `try / catch / finally` made sure the buttons were always enabled again.
- **`response.ok` matters because `fetch` only fails on network errors.** A 404 or 500 does not throw by itself, so I have to check the status and throw myself.
- **A join table is how a many-to-many relationship works in SQL.** Notes and tags need `note_tags` because a single column cannot hold a list, and the pair `(note_id, tag_id)` as the primary key stops duplicates.
- **Estimates decide the design.** Working out about 69 reads per second and 12 writes per second showed that QuickNotes is read-heavy and small enough for one SQL database, so the effort should go into caching, replicas and availability.
- **Every trade-off has a cost.** The cache and the read replica make reads fast, but both can show slightly old data, so the design needs ways to handle that, such as clearing the cache after a write.
- **A fake API changes how you design the client.** Because JSONPlaceholder does not store new notes, I had to decide how deleting a note that never existed on the server should behave.