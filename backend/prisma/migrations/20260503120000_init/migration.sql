-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('DRAFT', 'IMPORTING_METADATA', 'FETCHING_SOURCE', 'PARSING_CHAPTERS', 'GENERATING_EMBEDDINGS', 'NEEDS_REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReadingMode" AS ENUM ('GUIDED', 'FREE_READ');

-- CreateEnum
CREATE TYPE "ChapterProgressStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('CHAPTER_SUMMARY', 'CHAPTER_QUIZ', 'PODCAST_SCRIPT', 'PODCAST_AUDIO');

-- CreateEnum
CREATE TYPE "ArtifactStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "daily_goal_minutes" INTEGER NOT NULL DEFAULT 15,
    "reading_streak_current" INTEGER NOT NULL DEFAULT 0,
    "reading_streak_best" INTEGER NOT NULL DEFAULT 0,
    "last_streak_date" DATE,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_days" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "minutes_read" INTEGER NOT NULL DEFAULT 0,
    "chapters_completed_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL,
    "gutenberg_id" INTEGER,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "slug" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "BookStatus" NOT NULL DEFAULT 'DRAFT',
    "cover_url" TEXT,
    "source_url" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "title" TEXT,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "paragraph_count" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paragraphs" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "paragraph_index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paragraphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_books" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "mode" "ReadingMode" NOT NULL DEFAULT 'GUIDED',
    "current_chapter_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "user_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_chapter_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "status" "ChapterProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "read_paragraph_count" INTEGER NOT NULL DEFAULT 0,
    "total_paragraph_count" INTEGER NOT NULL DEFAULT 0,
    "dwell_seconds" INTEGER NOT NULL DEFAULT 0,
    "last_paragraph_index" INTEGER,
    "completion_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manually_completed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_chapter_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_paragraph_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "paragraph_id" UUID NOT NULL,
    "dwell_seconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_visible_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_paragraph_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_artifacts" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'PENDING',
    "content_json" JSONB,
    "storage_key" TEXT,
    "model" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "artifact_id" UUID,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "answers_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "step" TEXT,
    "input_json" JSONB,
    "result_json" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "reading_days_user_id_date_idx" ON "reading_days"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "reading_days_user_id_date_key" ON "reading_days"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "books_gutenberg_id_key" ON "books"("gutenberg_id");

-- CreateIndex
CREATE UNIQUE INDEX "books_slug_key" ON "books"("slug");

-- CreateIndex
CREATE INDEX "books_status_idx" ON "books"("status");

-- CreateIndex
CREATE INDEX "books_title_idx" ON "books"("title");

-- CreateIndex
CREATE INDEX "chapters_book_id_idx" ON "chapters"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_book_id_chapter_number_key" ON "chapters"("book_id", "chapter_number");

-- CreateIndex
CREATE INDEX "paragraphs_chapter_id_idx" ON "paragraphs"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "paragraphs_chapter_id_paragraph_index_key" ON "paragraphs"("chapter_id", "paragraph_index");

-- CreateIndex
CREATE INDEX "user_books_book_id_idx" ON "user_books"("book_id");

-- CreateIndex
CREATE INDEX "user_books_user_id_last_opened_at_idx" ON "user_books"("user_id", "last_opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_books_user_id_book_id_key" ON "user_books"("user_id", "book_id");

-- CreateIndex
CREATE INDEX "user_chapter_progress_chapter_id_idx" ON "user_chapter_progress"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_chapter_progress_user_id_chapter_id_key" ON "user_chapter_progress"("user_id", "chapter_id");

-- CreateIndex
CREATE INDEX "user_paragraph_progress_paragraph_id_idx" ON "user_paragraph_progress"("paragraph_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_paragraph_progress_user_id_paragraph_id_key" ON "user_paragraph_progress"("user_id", "paragraph_id");

-- CreateIndex
CREATE INDEX "ai_artifacts_book_id_idx" ON "ai_artifacts"("book_id");

-- CreateIndex
CREATE INDEX "ai_artifacts_status_idx" ON "ai_artifacts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_artifacts_chapter_id_type_key" ON "ai_artifacts"("chapter_id", "type");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_chapter_id_idx" ON "quiz_attempts"("user_id", "chapter_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_book_id_idx" ON "ingestion_jobs"("book_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_status_idx" ON "ingestion_jobs"("status");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_days" ADD CONSTRAINT "reading_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paragraphs" ADD CONSTRAINT "paragraphs_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_books" ADD CONSTRAINT "user_books_current_chapter_id_fkey" FOREIGN KEY ("current_chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chapter_progress" ADD CONSTRAINT "user_chapter_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chapter_progress" ADD CONSTRAINT "user_chapter_progress_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_paragraph_progress" ADD CONSTRAINT "user_paragraph_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_paragraph_progress" ADD CONSTRAINT "user_paragraph_progress_paragraph_id_fkey" FOREIGN KEY ("paragraph_id") REFERENCES "paragraphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "ai_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
