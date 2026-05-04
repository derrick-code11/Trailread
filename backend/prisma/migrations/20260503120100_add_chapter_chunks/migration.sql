-- pgvector: chapter chunk embeddings (raw SQL per database-design.md)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chapter_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  chapter_number INT NOT NULL,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  paragraph_start_index INT NOT NULL,
  paragraph_end_index INT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chapter_id, chunk_index)
);

CREATE INDEX chapter_chunks_chapter_id_idx
  ON chapter_chunks(chapter_id);

CREATE INDEX chapter_chunks_embedding_hnsw_idx
  ON chapter_chunks
  USING hnsw (embedding vector_cosine_ops);
