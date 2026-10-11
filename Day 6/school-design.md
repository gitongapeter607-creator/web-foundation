# School Database Design

## Tables

### students

- Stores one row per student.
- `student_id` is the primary key.
- `name` and `email` are `NOT NULL`, and `email` is `UNIQUE` so two students cannot share an address.

### courses

- Stores one row per course.
- `course_id` is the primary key.
- `title` and `credits` are `NOT NULL`, and a `CHECK` makes sure credits are above zero.

### enrolments

- Stores one row per student taking a course. This is the join table.
- `enrolment_id` is the primary key.
- `student_id` and `course_id` are foreign keys pointing to `students` and `courses`, and both are `NOT NULL`.
- `grade` is allowed to be `NULL` because a student has no grade until the course is marked. A `CHECK` keeps it between 0 and 100.
- `UNIQUE (student_id, course_id)` stops the same student enrolling on the same course twice.

## Relationships

- **students to enrolments is one-to-many.** One student can have many enrolments, but each enrolment belongs to exactly one student.
- **courses to enrolments is one-to-many.** One course can have many enrolments, but each enrolment belongs to exactly one course.
- **students to courses is many-to-many.** One student takes many courses, and one course has many students.

### Why a join table is needed

A relational table cannot store a list in a single column. Putting a `course_id` column in `students` would only allow one course per student, and putting a `student_id` column in `courses` would only allow one student per course. A third table solves this: each row in `enrolments` links one student to one course, so any number of links can exist. It is also the natural place for data about the link itself, which here is the grade.

## Index

I would add an index on `enrolments(course_id)`.

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

**Reason:** queries such as "all students on one course" and "number of students per course" look up enrolments by `course_id`. The `UNIQUE (student_id, course_id)` constraint already creates an index that helps searches by `student_id`, but it does not help searches that start with `course_id`. Without this index, the database has to scan the whole enrolments table, which gets slow as the table grows.

## SQL or NoSQL?

I would choose SQL for this system. The data is structured and highly related: students, courses and enrolments all link to each other, and the questions we ask (courses per student, students per course, students with no enrolments) are exactly what joins and `GROUP BY` are good at. SQL also lets the database enforce the rules for us, such as unique emails, valid foreign keys and no duplicate enrolments, so bad data is rejected before it is stored. Grades and enrolments also need to stay accurate, and SQL transactions give that reliability. A NoSQL document database would suit data with a flexible or changing shape, or very large scale with simple lookups, but a school's data is stable and relational, so the extra flexibility would not help much and we would lose the built-in integrity checks.