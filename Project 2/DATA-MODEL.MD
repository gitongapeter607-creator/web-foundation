# QuickNotes Data Model

QuickNotes stores four entities: **users**, **notes**, **tags** and **note_tags**.

## Entities

### users

| Column | Type | Key / constraints |
|--------|------|-------------------|
| id | INTEGER | Primary key |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL (never the plain password) |
| display_name | VARCHAR(100) | NOT NULL |
| created_at | TIMESTAMP | NOT NULL, default now |

### notes

| Column | Type | Key / constraints |
|--------|------|-------------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to `users.id`, NOT NULL |
| title | VARCHAR(100) | NOT NULL |
| body | TEXT | optional |
| created_at | TIMESTAMP | NOT NULL, default now |
| updated_at | TIMESTAMP | NOT NULL, default now |

### tags

| Column | Type | Key / constraints |
|--------|------|-------------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to `users.id`, NOT NULL |
| name | VARCHAR(50) | NOT NULL, UNIQUE together with `user_id` |

### note_tags (join table)

| Column | Type | Key / constraints |
|--------|------|-------------------|
| note_id | INTEGER | Foreign key to `notes.id`, part of the primary key |
| tag_id | INTEGER | Foreign key to `tags.id`, part of the primary key |

The primary key of `note_tags` is the pair `(note_id, tag_id)`, so the same tag cannot be attached to the same note twice.

## Relationships

- **users to notes is one-to-many.** One user writes many notes, and each note belongs to exactly one user (`notes.user_id`).
- **users to tags is one-to-many.** One user creates many tags, and each tag belongs to one user (`tags.user_id`). This keeps every user's tags private.
- **notes to tags is many-to-many.** One note can have many tags (for example "study" and "urgent"), and one tag can be on many notes.

A relational table cannot hold a list in one column, so a many-to-many relationship needs a **join table**. `note_tags` holds one row for each note-tag pair, which turns the many-to-many relationship into two one-to-many relationships (notes to note_tags, and tags to note_tags).

## CREATE TABLE statements

These are written for SQLite so they run in a playground. In PostgreSQL, replace `INTEGER PRIMARY KEY AUTOINCREMENT` with `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    title      VARCHAR(100) NOT NULL,
    body       TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE tags (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name    VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id  INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags (id)  ON DELETE CASCADE
);
```

`ON DELETE CASCADE` means that deleting a note also removes its rows in `note_tags`, and deleting a user removes that user's notes and tags, so no orphan rows are left behind.

## Example queries

**1. The latest 10 notes for one user (used by `GET /notes`)**

```sql
SELECT id, title, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

**2. All of a user's notes that have a given tag (JOIN, used by `GET /notes?tag=personal`)**

```sql
SELECT n.id, n.title, n.created_at
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t       ON t.id = nt.tag_id
WHERE n.user_id = 1 AND t.name = 'personal'
ORDER BY n.created_at DESC;
```

**3. How many notes each tag has (LEFT JOIN and GROUP BY, so unused tags show 0)**

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
WHERE t.user_id = 1
GROUP BY t.id, t.name
ORDER BY note_count DESC;
```

**4. Edit a note (used by `PUT /notes/{id}`)**

```sql
UPDATE notes
SET title = 'Buy oat milk', updated_at = CURRENT_TIMESTAMP
WHERE id = 1 AND user_id = 1;
```

The `AND user_id = 1` part makes sure users can only change their own notes.

## Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);
CREATE INDEX idx_note_tags_tag_id ON note_tags (tag_id);
```

- **`notes (user_id, created_at DESC)`:** the most common request is "show this user's newest notes", which is query 1. This index lets the database jump straight to one user's notes already sorted by date, instead of scanning the whole table and sorting. With millions of notes this is the difference between a fast response and a slow one.
- **`note_tags (tag_id)`:** the primary key `(note_id, tag_id)` already speeds up lookups starting from a note, but "all notes with this tag" starts from the tag, so it needs its own index.

## SQL or NoSQL?

I would choose **SQL** (for example PostgreSQL). The data is structured and connected: users own notes, and notes and tags have a many-to-many relationship, which SQL handles naturally with joins. Foreign keys, `UNIQUE` constraints and `NOT NULL` let the database reject bad data (a note with no owner, a duplicate email) so the application does not have to catch every case. Transactions keep related changes together, for example creating a note and attaching its tags either fully succeeds or fully fails. QuickNotes will have about 1 million users, which is well within what one SQL primary with a read replica can handle, so the main reason to pick NoSQL (huge scale or very flexible data) does not apply. A NoSQL document store could hold a note with its tags in one document, but queries such as "all notes with this tag across a user" and consistency between collections would be harder.