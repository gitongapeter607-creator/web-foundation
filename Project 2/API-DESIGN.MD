# QuickNotes API Design

This document describes the real QuickNotes REST API that the backend team should build. It is not the JSONPlaceholder practice API used by the front-end client.

## Design rules

- **Base URL:** `https://api.quicknotes.example/v1`
- **Resources are nouns:** `/notes`, `/tags`. The HTTP method says the action.
- **Format:** every request and response body is JSON (`Content-Type: application/json`).
- **Authentication:** after logging in, the client sends `Authorization: Bearer <token>` on every request except login. The user is identified from the token, so a user only ever sees their own notes.
- **Ids** are integers and appear in the path, for example `/notes/42`.

## Endpoints

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| POST | `/auth/login` | Log in with email and password and receive a token. | 200 OK |
| GET | `/notes` | List the logged-in user's notes (newest first). Supports `?page=`, `?limit=` and `?tag=`. | 200 OK |
| GET | `/notes/{id}` | Get one note by id. | 200 OK |
| POST | `/notes` | Create a new note. | 201 Created |
| PUT | `/notes/{id}` | Replace the title and body of an existing note. | 200 OK |
| DELETE | `/notes/{id}` | Delete a note. | 204 No Content |
| GET | `/tags` | List the logged-in user's tags. | 200 OK |
| POST | `/notes/{id}/tags` | Attach a tag to a note (creates the tag if it does not exist yet). | 201 Created |
| DELETE | `/notes/{id}/tags/{tagId}` | Remove a tag from a note. | 204 No Content |

## Examples

### Create a note

**Request**

```http
POST /v1/notes HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{
  "title": "Study plan",
  "body": "Revise SQL joins and REST status codes."
}
```

**Response: 201 Created**

```http
HTTP/1.1 201 Created
Location: /v1/notes/42
Content-Type: application/json

{
  "id": 42,
  "title": "Study plan",
  "body": "Revise SQL joins and REST status codes.",
  "tags": [],
  "createdAt": "2026-10-11T09:30:00Z",
  "updatedAt": "2026-10-11T09:30:00Z"
}
```

The `title` is required and at most 100 characters. The `body` is optional. The `userId` is not sent in the body because the server takes it from the token.

### List notes

**Request**

```http
GET /v1/notes?page=1&limit=2 HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer eyJhbGciOi...
```

**Response: 200 OK**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "id": 42,
      "title": "Study plan",
      "body": "Revise SQL joins and REST status codes.",
      "tags": ["study"],
      "createdAt": "2026-10-11T09:30:00Z",
      "updatedAt": "2026-10-11T09:30:00Z"
    },
    {
      "id": 41,
      "title": "Buy milk",
      "body": "2 litres",
      "tags": ["personal"],
      "createdAt": "2026-10-10T18:05:00Z",
      "updatedAt": "2026-10-10T18:05:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 17
}
```

When the user has no notes, the API still returns 200 with `"data": []` and `"total": 0`. An empty list is not an error.

## Error codes

Every error uses the same JSON shape, so the client can always read `error.message`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be 100 characters or fewer.",
    "details": [
      { "field": "title", "problem": "required" }
    ]
  }
}
```

| Status | Name | When it happens | Example error body |
|--------|------|-----------------|--------------------|
| 400 | Bad Request | The request is malformed or fails validation, for example `POST /notes` with no title, a title over 100 characters, or invalid JSON. | `{"error": {"code": "VALIDATION_ERROR", "message": "The title is required."}}` |
| 401 | Unauthorized | The user is not authenticated: no token, an expired token, or a wrong password on login. | `{"error": {"code": "UNAUTHENTICATED", "message": "Your session has expired. Please log in again."}}` |
| 403 | Forbidden | The user is logged in but not allowed to do this, for example deleting a note that belongs to someone else. | `{"error": {"code": "FORBIDDEN", "message": "You do not have permission to delete this note."}}` |
| 404 | Not Found | The note or tag does not exist, for example `GET /notes/9999`. | `{"error": {"code": "NOT_FOUND", "message": "Note 9999 was not found."}}` |
| 500 | Internal Server Error | An unexpected failure on the server, such as the database being unreachable. The message never exposes internal details. | `{"error": {"code": "SERVER_ERROR", "message": "Something went wrong on our side. Please try again later."}}` |

Other codes the API may return: **409 Conflict** (attaching a tag that is already on the note) and **429 Too Many Requests** (a client sends too many requests in a short time).