# QuickNotes Architecture

QuickNotes is moving from a browser-only app to an online service for **1 million users**. This document describes the requirements, the expected load and the architecture the backend team should build.

## Requirements

### Functional requirements

- Users can register and log in.
- A logged-in user can create, view, edit and delete their own notes.
- A user can add tags to notes and filter their notes by tag.
- Users only ever see their own notes.
- The note list loads quickly and supports paging.

### Non-functional requirements

- **Availability:** 99.9% uptime. No single failure should take the service down.
- **Performance:** loading the note list should take under 300 ms for most requests (95th percentile).
- **Scalability:** support 1 million registered users, and handle peak traffic of 5× the average.
- **Durability:** a saved note must never be lost, so the database is replicated and backed up daily.
- **Consistency:** a user must see their own new or edited note immediately (read-your-own-writes).
- **Security:** HTTPS everywhere, hashed passwords, token-based login, and a check on every request that the note belongs to the user.

## Load estimate

### Assumptions

- 1,000,000 registered users.
- 20% are active each day, so **200,000 daily active users (DAU)**.
- Each active user loads their notes **30 times a day** (opening the app, refreshing, filtering). These are the reads.
- Each active user makes **5 writes a day**: 3 new notes, 1 edit and 1 delete.
- Peak traffic is **5×** the average.
- An average note, including its metadata and index entries, takes **2 KB**.
- 86,400 seconds in a day, 365 days in a year, and 1 GB = 1,000,000 KB.

### Results

| Estimate | Calculation | Average | Peak (5×) |
|----------|-------------|---------|-----------|
| Reads per second | 200,000 × 30 = 6,000,000 per day / 86,400 | **about 69 reads/s** | **about 347 reads/s** |
| Writes per second | 200,000 × 5 = 1,000,000 per day / 86,400 | **about 11.6 writes/s** | **about 58 writes/s** |
| Storage per year | 200,000 × 3 = 600,000 new notes per day × 2 KB = 1.2 GB per day × 365 | **about 438 GB per year (0.44 TB)** | |

The system is **read-heavy**, with about 6 reads for every write. The traffic is small for modern hardware, so the architecture is designed mostly for **availability and low latency**, not raw throughput. The storage figure is for one copy of the data. With a read replica and backups, the real disk space needed is about two to three times higher.

## Architecture diagram

```
                          +-------------------+
                          |      Client       |
                          | (browser / mobile)|
                          +-------------------+
                                    |
                                    v
                          +-------------------+
                          |        DNS        |
                          +-------------------+
                                    |
              +---------------------+----------------------+
              | static files                               | API requests
              | (HTML, CSS, JS)                            | (GET/POST /notes ...)
              v                                            v
     +-------------------+                      +-------------------+
     |        CDN        |                      |   Load Balancer   |
     +-------------------+                      |  (two, failover)  |
                                                +-------------------+
                                                  |       |       |
                                                  v       v       v
                                              +-------+ +-------+ +-------+
                                              | App   | | App   | | App   |
                                              | Srv 1 | | Srv 2 | | Srv N |
                                              +-------+ +-------+ +-------+
                                                  |       |       |
            +------------------+------------------+-------+-------+----------+
            |                  |                          |                  |
            v                  v                          v                  v
     +-------------+   +---------------+          +---------------+   +-------------+
     |    Cache    |   |  Primary DB   |--------->|  Read Replica |   |    Queue    |
     |   (Redis)   |   |   (writes)    | copies   |    (reads)    |   |             |
     +-------------+   +---------------+ changes  +---------------+   +-------------+
                                                                             |
                                                                             v
                                                                      +-------------+
                                                                      |   Worker(s) |
                                                                      +-------------+

   Writes:  App Server --> Primary DB
   Reads:   App Server --> Cache --(on a miss)--> Read Replica
   Jobs:    App Server --> Queue --> Worker
```

## Components

- **Client:** the browser or mobile app that shows the notes and sends API requests, so users never touch the servers directly.
- **DNS:** it turns the name `api.quicknotes.example` into the address of the load balancer, so users reach the service by name and we can move servers without changing the address.
- **CDN:** it keeps copies of the static files (HTML, CSS, JavaScript) close to users around the world, so the app loads fast and our servers are not busy sending the same files again and again.
- **Load balancer:** it spreads requests across the app servers and stops sending traffic to any server that fails a health check, so no single server is overloaded and one crash does not stop the service.
- **App servers:** they run the API logic (checking tokens, validating input, reading and writing notes), and because they keep no user data in memory, we can add more of them as traffic grows.
- **Cache:** it keeps recently requested note lists in fast memory, so repeated reads are answered quickly without touching the database.
- **Primary database:** it is the single source of truth that handles all writes, so notes are stored reliably with rules (keys, constraints) that keep the data correct.
- **Read replica:** it is a live copy of the primary that answers read queries, so the many reads do not slow down writes and it can take over if the primary fails.
- **Queue:** it holds background jobs, so a request can finish immediately instead of waiting for slow work such as sending an email.
- **Worker:** it takes jobs from the queue and runs them in the background (updating the search index, sending emails), and we can add more workers if the queue grows.

## Request flows

### GET /notes (list notes)

1. The client sends `GET /v1/notes?page=1` with its token. DNS resolves the API name to the load balancer.
2. The load balancer forwards the request to a healthy app server.
3. The app server checks the token. If it is missing or expired, it returns **401**.
4. The app server builds a cache key such as `notes:user:42:page:1` and looks in the **cache**.
5. **Cache hit:** the app server returns the cached list with **200 OK**, and the flow ends here.
6. **Cache miss:** the app server runs the query on the **read replica** (the latest notes for this user, newest first).
7. The app server stores the result in the cache with a short expiry (for example 60 seconds).
8. The app server returns the JSON list with **200 OK**.

### POST /notes (create a note)

1. The client sends `POST /v1/notes` with its token and a JSON body (`title`, `body`).
2. The load balancer forwards the request to a healthy app server.
3. The app server checks the token (**401** if invalid) and validates the body. A missing title or a title over 100 characters returns **400**.
4. The app server inserts the note into the **primary database**, taking the user id from the token.
5. The app server deletes this user's cached note lists, so the next `GET /notes` is fresh.
6. The app server puts a "note created" job on the **queue**.
7. The app server returns **201 Created** with the new note and a `Location` header, without waiting for the job.
8. A **worker** picks up the job later and does the background work (for example updating the search index). Meanwhile, the primary copies the new row to the read replica.

## Trade-offs

- **Caching: speed vs freshness.** The cache makes note lists much faster and protects the database, but cached data can be slightly out of date. We reduce this by clearing a user's cache after each write and by using a short expiry. The cost is extra complexity, because we must remember to clear the cache whenever notes change.
- **Read replica: scale vs consistency.** Reads on the replica scale well, but the replica receives changes a moment after the primary (replication lag). A user could create a note and then briefly not see it in the list. We avoid this by returning the new note in the POST response and by reading a user's list from the primary for a few seconds after they write.
- **Queue and worker: fast responses vs delayed work.** Background jobs keep requests fast and absorb spikes, but the work is done a little later (eventual consistency), so a search index may lag behind the notes. It also adds one more system to run and monitor.
- **SQL primary: strong consistency vs write scaling.** One primary database keeps data correct and simple, but all writes go through one machine. At about 58 writes per second at peak this is easily fine, and if it grew much larger we could partition the data by user.

## Avoiding single points of failure

| Component | How a single failure is avoided |
|-----------|--------------------------------|
| DNS | Use a provider with several name servers (ideally two providers). |
| CDN | It is already spread across many locations worldwide. |
| Load balancer | Run two (an active pair or a managed, multi-zone balancer) with automatic failover. |
| App servers | Run at least two, in different availability zones. They are stateless, so any of them can handle any request, and the load balancer drops a failed one. |
| Cache | Run it with a replica. If the cache is lost, requests simply fall back to the database, which is slower but still works. |
| Primary database | Keep a replica in another zone and promote it automatically if the primary fails. Take daily backups and test restoring them. |
| Queue | Use a replicated or managed queue that keeps jobs on disk, so no job is lost if one node fails. |
| Workers | Run more than one. If a worker dies while handling a job, the job returns to the queue and another worker retries it. |