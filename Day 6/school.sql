-- day6/school.sql
-- School database: students, courses and enrolments (SQLite)

PRAGMA foreign_keys = ON;

-- Drop in reverse order so the script can be re-run safely
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;

-- ---------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT NOT NULL,
    credits   INTEGER NOT NULL CHECK (credits > 0)
);

CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL,
    course_id    INTEGER NOT NULL,
    grade        INTEGER CHECK (grade BETWEEN 0 AND 100),  -- NULL until graded
    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id)  REFERENCES courses (course_id),
    UNIQUE (student_id, course_id)  -- same student cannot enrol on the same course twice
);

-- ---------------------------------------------------------
-- 2. Sample data
-- ---------------------------------------------------------

INSERT INTO students (name, email) VALUES
    ('Alice Johnson', 'alice@example.com'),
    ('Brian Otieno',  'brian@example.com'),
    ('Chloe Kim',     'chloe@example.com'),
    ('David Mwangi',  'david@example.com'),
    ('Emma Rossi',    'emma@example.com');

INSERT INTO courses (title, credits) VALUES
    ('Web Technologies', 15),
    ('Database Systems', 15),
    ('Networking',       10),
    ('Calculus',         10);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 78),
    (1, 2, 85),
    (2, 1, 64),
    (2, 3, NULL),
    (3, 2, 91),
    (3, 3, 72),
    (3, 1, NULL),
    (4, 2, 55);

-- Emma (student 5) has no enrolments and Calculus (course 4) has no students,
-- so the LEFT JOIN queries below have something to find.

-- ---------------------------------------------------------
-- 3. Queries
-- ---------------------------------------------------------

-- Query 1: all courses for one student (by name)
SELECT c.title, c.credits, e.grade
FROM students s
JOIN enrolments e ON e.student_id = s.student_id
JOIN courses c    ON c.course_id  = e.course_id
WHERE s.name = 'Alice Johnson';

-- Query 2: all students on one course
SELECT s.name, s.email, e.grade
FROM courses c
JOIN enrolments e ON e.course_id  = c.course_id
JOIN students s   ON s.student_id = e.student_id
WHERE c.title = 'Database Systems';

-- Query 3: number of students per course (courses with none show 0)
SELECT c.title, COUNT(e.enrolment_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON e.course_id = c.course_id
GROUP BY c.course_id, c.title
ORDER BY student_count DESC;

-- Query 4: students who have no enrolments
SELECT s.student_id, s.name, s.email
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL;

-- Query 5: update one enrolment's grade (Brian's Networking grade)
UPDATE enrolments
SET grade = 68
WHERE student_id = (SELECT student_id FROM students WHERE email = 'brian@example.com')
  AND course_id  = (SELECT course_id  FROM courses  WHERE title = 'Networking');

-- Check the update worked
SELECT s.name, c.title, e.grade
FROM enrolments e
JOIN students s ON s.student_id = e.student_id
JOIN courses c  ON c.course_id  = e.course_id
WHERE s.name = 'Brian Otieno';