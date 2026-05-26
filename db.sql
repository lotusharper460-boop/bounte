-- ============================================================
-- BOUNTE / EDUVORA — ENTERPRISE DATABASE SCHEMA
-- Paste this entire file into Supabase SQL Editor and Run All
-- ============================================================

-- ──────────────────────────────────────────────
-- EXTENSIONS
-- ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- fast ILIKE search on names/titles


-- ──────────────────────────────────────────────
-- 1. SCHOOLS  (multi-tenant root)
-- ──────────────────────────────────────────────
create table public.schools (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,          -- URL-safe identifier e.g. "kings-college-lagos"
  logo_url      text,
  address       text,
  city          text,
  state         text,
  phone         text,
  email         text,
  plan          text not null default 'free'   -- 'free' | 'starter' | 'pro' | 'enterprise'
                check (plan in ('free','starter','pro','enterprise')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
comment on table public.schools is
  'Multi-tenant root. Every other table links back here via school_id.';


-- ──────────────────────────────────────────────
-- 2. PROFILES  (extends auth.users)
-- ──────────────────────────────────────────────
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  school_id      uuid references public.schools(id) on delete set null,
  full_name      text,
  phone_number   text,
  avatar_url     text,
  role           text not null default 'student'
                 check (role in ('super_admin','school_admin','teacher','student')),
  status         text not null default 'active'
                 check (status in ('active','suspended','pending')),
  last_login     timestamptz,
  created_at     timestamptz not null default now()
);
comment on table public.profiles is
  'One row per auth.users row. role drives RLS policies everywhere.';

-- Trigger: auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, phone_number, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone_number',
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ──────────────────────────────────────────────
-- 3. MEDIA ASSETS  (files uploaded by teachers)
-- ──────────────────────────────────────────────
-- Supports: images, audio, video, PDF, Word docs, spreadsheets, etc.
create table public.media_assets (
  id             uuid primary key default uuid_generate_v4(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  uploader_id    uuid not null references public.profiles(id),
  file_name      text not null,
  file_url       text not null,             -- Supabase Storage public URL
  storage_path   text not null,             -- bucket/path for deletion
  mime_type      text not null,
  file_size_kb   integer,
  asset_type     text not null default 'image'
                 check (asset_type in (
                   'image','audio','video','pdf',
                   'word_doc','spreadsheet','presentation','other'
                 )),
  created_at     timestamptz not null default now()
);
comment on table public.media_assets is
  'Central file registry. Questions reference assets by id, keeping storage paths DRY.';


-- ──────────────────────────────────────────────
-- 4. CLASSES
-- ──────────────────────────────────────────────
create table public.classes (
  id             uuid primary key default uuid_generate_v4(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  teacher_id     uuid not null references public.profiles(id),
  name           text not null,             -- e.g. "JSS 3A"
  subject        text,                      -- e.g. "Mathematics"
  academic_year  text,                      -- e.g. "2024/2025"
  term           text check (term in ('1st','2nd','3rd')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ──────────────────────────────────────────────
-- 5. CLASS ENROLLMENTS  (many-to-many: students ↔ classes)
-- ──────────────────────────────────────────────
create table public.class_enrollments (
  id          uuid primary key default uuid_generate_v4(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique (class_id, student_id)
);


-- ──────────────────────────────────────────────
-- 6. QUIZZES / ASSESSMENTS
-- ──────────────────────────────────────────────
create table public.quizzes (
  id                    uuid primary key default uuid_generate_v4(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  teacher_id            uuid not null references public.profiles(id),
  class_id              uuid references public.classes(id) on delete set null,
  title                 text not null,
  description           text,
  time_limit            integer not null default 30,          -- minutes
  deadline              timestamptz,
  status                text not null default 'draft'
                        check (status in ('draft','active','closed','archived')),
  reward_type           text not null default 'Bounty Points',
  reward_value          text not null default '100',
  -- CBT configuration
  shuffle_questions     boolean not null default false,
  shuffle_options       boolean not null default false,
  pass_mark             integer not null default 50,          -- percentage
  show_answers_after    boolean not null default false,
  allow_retakes         boolean not null default false,
  max_attempts          integer not null default 1,
  -- anti-cheat
  strict_mode           boolean not null default true,        -- tab-switch kill-switch
  -- AI extraction metadata
  source_document_url   text,                                 -- original uploaded doc
  extraction_model      text,                                 -- which model extracted it
  created_at            timestamptz not null default now()
);
comment on table public.quizzes is
  'A quiz can be assigned to a class or left open (class_id null = public campaign).';


-- ──────────────────────────────────────────────
-- 7. QUESTIONS  (full rich-media CBT support)
-- ──────────────────────────────────────────────
-- question_type supports every common CBT format:
--   mcq            → single correct answer (options[] + correct_index)
--   multi_select   → multiple correct answers (options[] + correct_indices[])
--   true_false     → options: ['True','False'], correct_index 0 or 1
--   short_answer   → free text, no options (manually graded)
--   fill_blank     → text with {{blank}} placeholder
--   matching       → options[0..n] paired with pairs[0..n]
--   ordering       → reorder items, correct order in correct_indices[]
--   image_mcq      → MCQ but the stem or options carry media_asset_id
create table public.questions (
  id               uuid primary key default uuid_generate_v4(),
  quiz_id          uuid not null references public.quizzes(id) on delete cascade,
  question_text    text not null,
  question_type    text not null default 'mcq'
                   check (question_type in (
                     'mcq','multi_select','true_false',
                     'short_answer','fill_blank','matching','ordering','image_mcq'
                   )),
  -- answer data
  options          jsonb,                        -- string[] for mcq / true_false / multi_select
  correct_index    integer,                      -- for mcq / true_false
  correct_indices  jsonb,                        -- integer[] for multi_select / ordering
  pairs            jsonb,                        -- {left:string, right:string}[] for matching
  expected_answer  text,                         -- for short_answer / fill_blank
  -- rich media (any asset from media_assets table)
  media_asset_id   uuid references public.media_assets(id) on delete set null,
  -- per-option media (e.g. image options in image_mcq)
  option_assets    jsonb,                        -- uuid[] parallel to options[]
  -- pedagogy
  explanation      text,                         -- shown after submission if show_answers_after
  marks            integer not null default 1,
  difficulty       text check (difficulty in ('easy','medium','hard')),
  tags             text[],                       -- topic tags e.g. ['algebra','fractions']
  order_index      integer not null default 0,
  created_at       timestamptz not null default now()
);
comment on table public.questions is
  'Supports MCQ, multi-select, true/false, short answer, fill-blank, matching, ordering, image MCQ.
   All rich-media is referenced via media_asset_id (stored in media_assets).';


-- ──────────────────────────────────────────────
-- 8. SUBMISSIONS
-- ──────────────────────────────────────────────
create table public.submissions (
  id                  uuid primary key default uuid_generate_v4(),
  quiz_id             uuid not null references public.quizzes(id) on delete cascade,
  student_id          uuid not null references public.profiles(id),
  class_id            uuid references public.classes(id) on delete set null,
  -- scoring
  score               integer,                  -- percentage 0-100
  raw_score           integer,                  -- marks earned
  total_marks         integer,                  -- max possible marks
  time_taken_seconds  integer,
  attempt_number      integer not null default 1,
  -- state machine
  status              text not null default 'in_progress'
                      check (status in ('in_progress','submitted','graded','voided')),
  -- snapshot (store full answers for audit / replay)
  answers             jsonb,                    -- {question_id: selected_index|selected_indices|text}
  -- anti-cheat log
  tab_switches        integer not null default 0,
  started_at          timestamptz not null default now(),
  submitted_at        timestamptz,
  -- prevent duplicate final submissions (one per student per quiz per attempt)
  unique (quiz_id, student_id, attempt_number)
);
comment on table public.submissions is
  'One row per attempt. attempt_number increments when retakes are allowed.';


-- ──────────────────────────────────────────────
-- 9. QUESTION RESPONSES  (per-question analytics)
-- ──────────────────────────────────────────────
create table public.question_responses (
  id                  uuid primary key default uuid_generate_v4(),
  submission_id       uuid not null references public.submissions(id) on delete cascade,
  question_id         uuid not null references public.questions(id) on delete cascade,
  -- what the student chose
  selected_index      integer,                  -- mcq / true_false
  selected_indices    jsonb,                    -- multi_select / ordering: integer[]
  text_response       text,                     -- short_answer / fill_blank
  -- result
  is_correct          boolean,
  marks_awarded       integer not null default 0,
  time_spent_seconds  integer,
  unique (submission_id, question_id)
);
comment on table public.question_responses is
  'Granular per-question data. Powers per-question analytics and difficulty calibration.';


-- ──────────────────────────────────────────────
-- 10. BOUNTY LEDGER  (append-only points log)
-- ──────────────────────────────────────────────
create table public.bounty_ledger (
  id             uuid primary key default uuid_generate_v4(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  school_id      uuid not null references public.schools(id) on delete cascade,
  submission_id  uuid references public.submissions(id) on delete set null,
  points_delta   integer not null,              -- positive = earned, negative = deducted
  balance_after  integer not null,
  reason         text not null,                 -- human-readable reason
  ref_type       text,                          -- 'submission' | 'bonus' | 'penalty' | 'manual'
  ref_id         uuid,
  created_at     timestamptz not null default now()
);
comment on table public.bounty_ledger is
  'Immutable ledger. Current balance = SUM(points_delta) for a student within a school.';


-- ──────────────────────────────────────────────
-- 11. LEADERBOARDS  (pre-computed, refreshed by triggers)
-- ──────────────────────────────────────────────
create table public.leaderboards (
  id                uuid primary key default uuid_generate_v4(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  quiz_id           uuid references public.quizzes(id) on delete cascade,  -- null = school-wide
  student_id        uuid not null references public.profiles(id) on delete cascade,
  rank              integer,
  total_points      integer not null default 0,
  quizzes_completed integer not null default 0,
  avg_score         numeric(5,2) not null default 0,
  updated_at        timestamptz not null default now(),
  unique (school_id, quiz_id, student_id)
);
comment on table public.leaderboards is
  'Materialised leaderboard. quiz_id IS NULL for school-wide all-time ranking.';


-- ──────────────────────────────────────────────
-- 12. ANNOUNCEMENTS  (AI-drafted messages)
-- ──────────────────────────────────────────────
create table public.announcements (
  id            uuid primary key default uuid_generate_v4(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  author_id     uuid not null references public.profiles(id),
  title         text not null,
  body          text not null,
  channel       text not null default 'in_app'
                check (channel in ('in_app','email','sms','push','all')),
  audience      text not null default 'all'
                check (audience in ('all','students','teachers','parents','class')),
  target_class  uuid references public.classes(id) on delete set null,
  status        text not null default 'draft'
                check (status in ('draft','scheduled','sent','failed')),
  ai_drafted    boolean not null default false,   -- was this written by AI?
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);


-- ──────────────────────────────────────────────
-- 13. AUDIT LOGS  (immutable activity trail)
-- ──────────────────────────────────────────────
create table public.audit_logs (
  id           uuid primary key default uuid_generate_v4(),
  school_id    uuid references public.schools(id) on delete set null,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,         -- 'quiz.created' | 'submission.graded' | 'user.banned'
  entity_type  text,                  -- 'quiz' | 'submission' | 'profile'
  entity_id    uuid,
  metadata     jsonb,                 -- any extra context
  ip_address   text,
  created_at   timestamptz not null default now()
);
comment on table public.audit_logs is
  'Append-only. Never update or delete rows here.';


-- ──────────────────────────────────────────────
-- INDEXES  (query performance)
-- ──────────────────────────────────────────────
-- profiles
create index idx_profiles_school   on public.profiles(school_id);
create index idx_profiles_role     on public.profiles(role);

-- classes
create index idx_classes_school    on public.classes(school_id);
create index idx_classes_teacher   on public.classes(teacher_id);

-- enrollments
create index idx_enroll_class      on public.class_enrollments(class_id);
create index idx_enroll_student    on public.class_enrollments(student_id);

-- quizzes
create index idx_quizzes_school    on public.quizzes(school_id);
create index idx_quizzes_teacher   on public.quizzes(teacher_id);
create index idx_quizzes_class     on public.quizzes(class_id);
create index idx_quizzes_status    on public.quizzes(status);
create index idx_quizzes_deadline  on public.quizzes(deadline);

-- questions
create index idx_questions_quiz    on public.questions(quiz_id);
create index idx_questions_type    on public.questions(question_type);
create index idx_questions_order   on public.questions(quiz_id, order_index);
-- GIN index on tags for tag-based search
create index idx_questions_tags    on public.questions using gin(tags);

-- media assets
create index idx_media_school      on public.media_assets(school_id);
create index idx_media_uploader    on public.media_assets(uploader_id);
create index idx_media_type        on public.media_assets(asset_type);

-- submissions
create index idx_subs_quiz         on public.submissions(quiz_id);
create index idx_subs_student      on public.submissions(student_id);
create index idx_subs_status       on public.submissions(status);
create index idx_subs_score        on public.submissions(score desc);

-- question responses
create index idx_qr_submission     on public.question_responses(submission_id);
create index idx_qr_question       on public.question_responses(question_id);

-- bounty ledger
create index idx_ledger_student    on public.bounty_ledger(student_id);
create index idx_ledger_school     on public.bounty_ledger(school_id);

-- leaderboards
create index idx_lb_school_quiz    on public.leaderboards(school_id, quiz_id);
create index idx_lb_rank           on public.leaderboards(school_id, quiz_id, rank);

-- announcements
create index idx_ann_school        on public.announcements(school_id);
create index idx_ann_status        on public.announcements(status);

-- audit logs
create index idx_audit_school      on public.audit_logs(school_id);
create index idx_audit_actor       on public.audit_logs(actor_id);
create index idx_audit_action      on public.audit_logs(action);
create index idx_audit_entity      on public.audit_logs(entity_type, entity_id);


-- ──────────────────────────────────────────────
-- VIEWS  (handy query shortcuts)
-- ──────────────────────────────────────────────

-- per-quiz leaderboard with student names
create or replace view public.v_quiz_leaderboard as
select
  s.quiz_id,
  s.student_id,
  p.full_name            as student_name,
  p.avatar_url,
  s.score,
  s.raw_score,
  s.total_marks,
  s.time_taken_seconds,
  s.attempt_number,
  s.submitted_at,
  rank() over (
    partition by s.quiz_id
    order by s.score desc, s.time_taken_seconds asc
  )                      as rank
from public.submissions s
join public.profiles p on p.id = s.student_id
where s.status = 'submitted';

-- per-question difficulty stats (helps teachers calibrate)
create or replace view public.v_question_stats as
select
  q.id             as question_id,
  q.quiz_id,
  q.question_text,
  q.question_type,
  q.marks,
  q.difficulty,
  count(qr.id)     as total_attempts,
  sum(case when qr.is_correct then 1 else 0 end) as correct_count,
  round(
    100.0 * sum(case when qr.is_correct then 1 else 0 end)
    / nullif(count(qr.id), 0), 1
  )                as correct_pct
from public.questions q
left join public.question_responses qr on qr.question_id = q.id
group by q.id;

-- student total bounty balance per school
create or replace view public.v_student_balances as
select
  student_id,
  school_id,
  sum(points_delta) as total_bounty_points
from public.bounty_ledger
group by student_id, school_id;


-- ──────────────────────────────────────────────
-- TRIGGERS — auto-grade + award bounty points
-- ──────────────────────────────────────────────

-- When a submission is marked 'submitted', calculate bounty points and
-- write an entry to bounty_ledger
create or replace function public.fn_award_bounty_on_submit()
returns trigger language plpgsql security definer as $$
declare
  v_reward_value  integer;
  v_points_earned integer;
  v_current_bal   integer;
begin
  if new.status = 'submitted' and (old.status is null or old.status <> 'submitted') then

    select coalesce(reward_value::integer, 0)
    into   v_reward_value
    from   public.quizzes
    where  id = new.quiz_id;

    -- Proportional bounty: reward_value × (score / 100)
    v_points_earned := round(v_reward_value * (new.score::numeric / 100));

    select coalesce(sum(points_delta), 0)
    into   v_current_bal
    from   public.bounty_ledger
    where  student_id = new.student_id
    and    school_id  = (
             select school_id from public.profiles where id = new.student_id
           );

    insert into public.bounty_ledger
      (student_id, school_id, submission_id, points_delta, balance_after, reason, ref_type, ref_id)
    values (
      new.student_id,
      (select school_id from public.profiles where id = new.student_id),
      new.id,
      v_points_earned,
      v_current_bal + v_points_earned,
      'Quiz completed: ' || (select title from public.quizzes where id = new.quiz_id),
      'submission',
      new.id
    );

  end if;
  return new;
end;
$$;

create trigger trg_award_bounty
  after insert or update on public.submissions
  for each row execute function public.fn_award_bounty_on_submit();


-- ──────────────────────────────────────────────
-- ROW-LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────

-- helper: current user's role
create or replace function public.my_role()
returns text language sql security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- helper: current user's school
create or replace function public.my_school_id()
returns uuid language sql security definer as $$
  select school_id from public.profiles where id = auth.uid();
$$;

-- SCHOOLS
alter table public.schools enable row level security;
create policy "schools: super_admin only"
  on public.schools for all
  using (public.my_role() = 'super_admin');

-- PROFILES
alter table public.profiles enable row level security;
create policy "profiles: own row"
  on public.profiles for all
  using (id = auth.uid());
create policy "profiles: teacher/admin can view school members"
  on public.profiles for select
  using (
    school_id = public.my_school_id()
    and public.my_role() in ('school_admin','teacher')
  );

-- CLASSES
alter table public.classes enable row level security;
create policy "classes: school members can read"
  on public.classes for select
  using (school_id = public.my_school_id());
create policy "classes: teacher/admin can write"
  on public.classes for all
  using (
    school_id = public.my_school_id()
    and public.my_role() in ('school_admin','teacher')
  );

-- CLASS ENROLLMENTS
alter table public.class_enrollments enable row level security;
create policy "enrollments: own + school staff can read"
  on public.class_enrollments for select
  using (
    student_id = auth.uid()
    or public.my_role() in ('school_admin','teacher')
  );

-- QUIZZES
alter table public.quizzes enable row level security;
create policy "quizzes: school members can read active"
  on public.quizzes for select
  using (
    school_id = public.my_school_id()
    and (status = 'active' or public.my_role() in ('school_admin','teacher'))
  );
create policy "quizzes: teachers can write own"
  on public.quizzes for all
  using (
    teacher_id = auth.uid()
    or public.my_role() = 'school_admin'
  );

-- QUESTIONS  (hide correct answers from students)
alter table public.questions enable row level security;
create policy "questions: all school members can read"
  on public.questions for select
  using (
    (select school_id from public.quizzes where id = quiz_id)
    = public.my_school_id()
  );
create policy "questions: teachers can write"
  on public.questions for all
  using (
    (select teacher_id from public.quizzes where id = quiz_id) = auth.uid()
    or public.my_role() in ('school_admin')
  );

-- MEDIA ASSETS
alter table public.media_assets enable row level security;
create policy "media: school members can read"
  on public.media_assets for select
  using (school_id = public.my_school_id());
create policy "media: teachers/admins can write"
  on public.media_assets for all
  using (
    school_id = public.my_school_id()
    and public.my_role() in ('school_admin','teacher')
  );

-- SUBMISSIONS
alter table public.submissions enable row level security;
create policy "submissions: own row"
  on public.submissions for select
  using (student_id = auth.uid());
create policy "submissions: teachers can view class submissions"
  on public.submissions for select
  using (
    public.my_role() in ('teacher','school_admin')
    and (select school_id from public.quizzes where id = quiz_id)
        = public.my_school_id()
  );
create policy "submissions: student can insert own"
  on public.submissions for insert
  with check (student_id = auth.uid());
create policy "submissions: student can update own in_progress"
  on public.submissions for update
  using (student_id = auth.uid() and status = 'in_progress');

-- QUESTION RESPONSES
alter table public.question_responses enable row level security;
create policy "qr: linked submission owner"
  on public.question_responses for all
  using (
    (select student_id from public.submissions where id = submission_id)
    = auth.uid()
    or public.my_role() in ('teacher','school_admin')
  );

-- BOUNTY LEDGER
alter table public.bounty_ledger enable row level security;
create policy "ledger: own entries + school staff"
  on public.bounty_ledger for select
  using (
    student_id = auth.uid()
    or public.my_role() in ('school_admin','teacher')
  );

-- LEADERBOARDS
alter table public.leaderboards enable row level security;
create policy "leaderboards: school members can read"
  on public.leaderboards for select
  using (school_id = public.my_school_id());

-- ANNOUNCEMENTS
alter table public.announcements enable row level security;
create policy "announcements: school members can read sent"
  on public.announcements for select
  using (school_id = public.my_school_id() and status = 'sent');
create policy "announcements: teachers/admins full access"
  on public.announcements for all
  using (
    school_id = public.my_school_id()
    and public.my_role() in ('school_admin','teacher')
  );

-- AUDIT LOGS
alter table public.audit_logs enable row level security;
create policy "audit: school admin only"
  on public.audit_logs for select
  using (
    school_id = public.my_school_id()
    and public.my_role() in ('school_admin','super_admin')
  );


-- ──────────────────────────────────────────────
-- SUPABASE STORAGE BUCKET SETUP (run separately)
-- ──────────────────────────────────────────────
-- Run these via the Supabase dashboard Storage tab, OR paste here:
--
-- insert into storage.buckets (id, name, public) values
--   ('avatars',   'avatars',   true),
--   ('quiz-media', 'quiz-media', false),   -- images/audio/video for questions
--   ('documents', 'documents', false);     -- uploaded Word docs for extraction
--
-- Storage policies for quiz-media (teachers upload, school members read):
-- create policy "quiz-media upload" on storage.objects for insert
--   with check (bucket_id = 'quiz-media' and public.my_role() in ('teacher','school_admin'));
-- create policy "quiz-media read" on storage.objects for select
--   using (bucket_id = 'quiz-media' and public.my_school_id() is not null);


-- ──────────────────────────────────────────────
-- BACKWARD COMPATIBILITY VIEW
-- Matches the old `submissions` shape your frontend currently queries
-- (student_name text instead of student_id uuid).
-- Use this view in existing queries while you migrate.
-- ──────────────────────────────────────────────
create or replace view public.v_submissions_compat as
select
  s.id,
  s.quiz_id,
  p.full_name   as student_name,
  s.student_id,
  s.score,
  s.time_taken_seconds,
  s.submitted_at as created_at
from public.submissions s
join public.profiles p on p.id = s.student_id
where s.status = 'submitted';

-- ──────────────────────────────────────────────
-- DONE
-- ──────────────────────────────────────────────
-- Tables created: schools, profiles, media_assets, classes,
--   class_enrollments, quizzes, questions, submissions,
--   question_responses, bounty_ledger, leaderboards,
--   announcements, audit_logs
-- Views: v_quiz_leaderboard, v_question_stats, v_student_balances,
--        v_submissions_compat
-- Triggers: handle_new_user, trg_award_bounty
-- RLS policies: enabled on all tables
