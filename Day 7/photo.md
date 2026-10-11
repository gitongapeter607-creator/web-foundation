# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from people they follow.

## Assumptions

- 10 million registered users.
- 10% of registered users are active each day.
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day.
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail.
- Traffic is spread evenly over 24 hours (86,400 seconds) for the average, and the peak is 5× the average.
- A year is 365 days, and 1 TB = 1,000,000 MB.
- Photo metadata (owner, caption, timestamps, URLs) is tiny compared with the photo files, so storage is estimated for photos only.

## Estimates

### Daily active users (DAU)

- 10,000,000 × 10% = **1,000,000 DAU**

### Uploads per second

- Uploads per day: 1,000,000 × 1 = 1,000,000
- Average: 1,000,000 / 86,400 ≈ **11.6 uploads/s**
- Peak (5×): ≈ **58 uploads/s**

### Feed views per second

- Feed views per day: 1,000,000 × 50 = 50,000,000
- Average: 50,000,000 / 86,400 ≈ **579 views/s**
- Peak (5×): ≈ **2,900 views/s**

### Photo storage per year

- Originals: 1,000,000 × 2 MB = 2 TB per day
- Thumbnails: 1,000,000 × 50 KB = 0.05 TB per day
- Total: 2.05 TB per day × 365 ≈ **748 TB per year (about 0.75 PB)**
- Of that, about 730 TB is originals and about 18 TB is thumbnails.

## Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are about 579 feed views per second against about 11.6 uploads per second, a ratio of roughly **50 reads to 1 write**. And one feed page shows many photos, so the number of image requests is even higher than the number of page views.

What this means for the design:

- Make reads cheap and fast: serve photos from a CDN and keep hot data in a cache so most requests never reach the database.
- Add a read replica so feed queries run on a copy and do not slow down the primary database that handles writes.
- Writes are rare and can be slower, so heavy work on upload (such as making thumbnails) is moved to a background queue.

## Why photos should not be stored inside the database

- **Size:** about 748 TB of new photos per year would make the database enormous, and databases are much more expensive to grow than file storage.
- **Speed:** large files take up memory and bandwidth in the database, which slows down the small, fast queries it is meant for.
- **Backups and replication:** every backup and every copy to a read replica would have to move all those photos.
- **Serving:** a database cannot hand files to a CDN easily, while storage built for files can.

Photos should go into **object storage**. The database stores only the photo's **key or URL** (a short text value) along with its metadata, and the browser loads the file itself from the CDN.

## Architecture diagram

```
                   Users (mobile app / web browser)
                      |                       |
        photo files   |                       |   API requests
        (thumbnails)  v                       v   (feed, upload)
                  +---------+          +---------------+
                  |   CDN   |          | Load Balancer |
                  +---------+          +---------------+
                      |                    |    |    |
                cache |                    v    v    v
                miss  |               +-----+ +-----+ +-----+
                      |               | App | | App | | App |
                      |               |  1  | |  2  | |  N  |
                      |               +-----+ +-----+ +-----+
                      |                  |  |   |  |
                      |      +-----------+  |   |  +----------------+
                      |      |              |   |                   |
                      |      v              |   v                   v
                      |  +-------+          | +-----------+   +-------------+
                      |  | Cache |          | |  Database |   | Job Queue   |
                      |  | (hot  |          | |  (primary)|   | (thumbnail  |
                      |  | feeds)|          | +-----------+   |  jobs)      |
                      |  +-------+          |   | replicates  +-------------+
                      |                     |   v                    |
                      |                     | +-----------+          v
                      |                     | | Read      |   +-------------+
                      |                     | | Replica   |   | Thumbnail   |
                      |                     | +-----------+   | Worker(s)   |
                      |                     |                 +-------------+
                      |                     v                        |
                      |             +------------------+             |
                      +-----------> |  Object Storage  | <-----------+
                                    | (originals +     |
                                    |  thumbnails)     |
                                    +------------------+

   Writes: App Servers -> Database (primary)
   Reads:  App Servers -> Cache -> Read Replica
```

## Components

- **CDN:** it stores copies of photos and thumbnails at locations close to users, so images load fast and most image traffic never reaches our servers.
- **Load balancer:** it spreads incoming requests across many app servers so no single server is overloaded and one failing server does not take the app down.
- **App servers:** they run the application logic (login, upload, building the feed), and because they keep no state, we can add more of them as traffic grows.
- **Cache:** it keeps frequently requested data such as popular feeds in fast memory, so repeated reads do not hit the database.
- **Database (primary):** it is the reliable source of truth for users, follows and photo metadata, and it handles all writes.
- **Read replica:** it is a live copy of the primary that serves read queries, so the heavy feed traffic does not slow down writes.
- **Object storage:** it stores the large photo files cheaply and durably at huge scale, which a database cannot do well.
- **Queue:** it holds thumbnail jobs so the upload request can finish immediately instead of waiting for slow image processing.
- **Worker:** it takes jobs from the queue and creates the thumbnails in the background, and we can add more workers if the queue grows.

## Upload flow

1. The user picks a photo and the app sends an upload request to SnapShare.
2. The request goes through the **load balancer** to one of the **app servers**.
3. The app server checks that the user is logged in and that the file is a valid image of an allowed size.
4. The app server saves the original photo in **object storage** and gets back its key.
5. The app server writes a new row in the **primary database** with the owner, caption, original photo key and a status of "processing".
6. The app server puts a "create thumbnail" job (with the photo id and key) on the **queue**.
7. The app server replies to the user right away that the upload succeeded, without waiting for the thumbnail.
8. A **worker** takes the job from the queue, downloads the original from object storage and creates a 50 KB thumbnail.
9. The worker saves the thumbnail in object storage and updates the database row with the thumbnail key and a status of "ready".
10. The relevant cached feeds are cleared or refreshed, so followers see the new photo in their feed, and its thumbnail is loaded through the **CDN**.

If a worker fails part way, the job stays in the queue (or goes back to it) and is retried, so no thumbnail is lost.

## Trade-offs

- **Caching: speed vs freshness.** A cache makes feeds much faster and takes load off the database, but cached data can be out of date, so a new photo might not appear in a feed for a short time. We also have to decide when to clear the cache, which adds complexity.
- **Read replica: scale vs consistency.** A replica lets us handle far more reads, but it copies data from the primary with a small delay (replication lag). A user could upload a photo and briefly not see it if their next read hits the replica, so we may read the user's own recent data from the primary.
- **Queue and worker: fast uploads vs delayed thumbnails.** Moving thumbnail creation to the background keeps uploads fast and lets us absorb spikes, but the thumbnail is not ready instantly, so the feed may need to show a placeholder or the original for a few seconds. It also adds more parts to run and monitor.
- **CDN: speed vs cost.** A CDN gives low latency and protects our servers, but it costs money, and a photo that is deleted or changed may stay cached at the edge until it expires or is purged.