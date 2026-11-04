-- =====================================================
-- Rating System - Database Schema (PostgreSQL)
-- شغّل هاد الملف مرة وحدة بـ Neon SQL Editor
-- =====================================================
--شكل الجداول 

-- 1) المستخدمين: طلاب وستاف
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login         TEXT UNIQUE NOT NULL,              -- اسم الدخول (زي intra login)
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,                     -- الباسورد مشفّر، مش نص عادي
  role          TEXT NOT NULL DEFAULT 'STUDENT'
                CHECK (role IN ('STUDENT', 'STAFF')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) فترات التصويت: الستاف بيحدد البداية والنهاية وعدد الأصوات
CREATE TABLE voting_windows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  min_votes   INT NOT NULL DEFAULT 1,
  max_votes   INT NOT NULL DEFAULT 5,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (min_votes >= 0 AND min_votes <= max_votes)
);

-- 3) الـ labels: كل label إلها النجوم المسموحة ونوعها
CREATE TABLE labels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  allowed_stars INT[] NOT NULL,                    -- مثال: {2,3} يعني بتبين مع 2 و 3 نجوم
  severity      TEXT NOT NULL
                CHECK (severity IN ('POSITIVE', 'MINOR', 'SERIOUS')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) التقييمات: مين قيّم مين، بأي فترة، وكم نجمة
CREATE TABLE ratings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id           UUID NOT NULL REFERENCES users(id),   -- اللي قيّم
  ratee_id           UUID NOT NULL REFERENCES users(id),   -- اللي انقيّم
  window_id          UUID NOT NULL REFERENCES voting_windows(id),
  stars              INT NOT NULL CHECK (stars BETWEEN 1 AND 3),
  explanation        TEXT,                                  -- إجباري مع الـ serious flags (بنفحصه بالكود)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_invalidated     BOOLEAN NOT NULL DEFAULT false,        -- الستاف لغاه بسبب abuse
  invalidated_reason TEXT,
  invalidated_by     UUID REFERENCES users(id),
  invalidated_at     TIMESTAMPTZ,
  CHECK (rater_id <> ratee_id),                             -- ما بتقدر تقيّم حالك
  UNIQUE (rater_id, ratee_id, window_id)                    -- ما بتقدر تقيّم نفس الشخص مرتين بنفس الفترة
);

-- 5) ربط التقييم بالـ labels (التقييم الواحد ممكن يكون إله أكثر من label)
CREATE TABLE rating_labels (
  rating_id UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  label_id  UUID NOT NULL REFERENCES labels(id),
  PRIMARY KEY (rating_id, label_id)
);

-- 6) كل محاولة تصويت (حتى المرفوضة) عشان نكشف الـ repeated votes
CREATE TABLE vote_attempts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id   UUID NOT NULL REFERENCES users(id),
  ratee_id   UUID NOT NULL REFERENCES users(id),
  window_id  UUID REFERENCES voting_windows(id),
  result     TEXT NOT NULL,                       -- 'OK' أو سبب الرفض
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) حالات الغش اللي النظام كشفها
CREATE TABLE abuse_cases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id   UUID REFERENCES voting_windows(id),
  type        TEXT NOT NULL CHECK (type IN (
                'BULK', 'REPEATED', 'GROUP', 'REVENGE',
                'FRIENDS_BOOST', 'TOO_FAST', 'EXTREME_VOTER', 'MALICIOUS_SERIOUS')),
  severity    TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  summary     TEXT NOT NULL,                      -- جملة بلغة بسيطة للستاف
  status      TEXT NOT NULL DEFAULT 'OPEN'
              CHECK (status IN ('OPEN', 'CONFIRMED', 'DISMISSED')),
  student_ids UUID[] NOT NULL DEFAULT '{}',       -- الطلاب المتورطين
  rating_ids  UUID[] NOT NULL DEFAULT '{}',       -- التقييمات المشبوهة
  case_key    TEXT UNIQUE NOT NULL,               -- عشان نفس الحالة ما تنعاد مرتين
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ
);

-- 8) سجل كل إشي بيعمله الستاف
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES users(id),
  action     TEXT NOT NULL,                       -- مثال: 'INVALIDATE_RATING'
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes: بتسرّع البحث
CREATE INDEX idx_ratings_ratee  ON ratings (ratee_id);
CREATE INDEX idx_ratings_rater  ON ratings (rater_id);
CREATE INDEX idx_ratings_window ON ratings (window_id, created_at);
CREATE INDEX idx_attempts_rater ON vote_attempts (rater_id, created_at);
