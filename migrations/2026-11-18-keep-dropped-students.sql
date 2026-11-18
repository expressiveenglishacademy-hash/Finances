-- migrations/2026-11-18-keep-dropped-students.sql
-- Additive only. The app does not run this file.
-- Run it yourself in the Supabase SQL editor when you want the drop
-- date to sync between browsers. Until then, the app keeps that date
-- in this browser and does not send the column.
--
-- Do not edit, drop, or rename any current table or column.
-- Do not run an UPDATE that touches every student.

alter table public.students
  add column if not exists dropped_off_date date;

-- Look first. This only reads.
-- select id, name, status, dropped_off_date
-- from public.students
-- order by name;

-- The app used to turn any status other than "Inactivo" or "Dropped Off"
-- into "Activo" and then save that. A browser that still had the old
-- "Activo" copy could also replace a "Dropped Off" row during sync.
-- There is no hidden list of who that happened to. Do not guess.
--
-- If you still know the ids, you can restore just those rows.
-- Replace the sample ids, then run it. Anyone not listed stays as they are.
--
-- update public.students
-- set status = 'Dropped Off'
-- where id in (
--   'paste-one-student-id',
--   'paste-another-student-id'
-- );
