-- Full-text search on notes (English). Used with websearch_to_tsquery in the API.
CREATE INDEX IF NOT EXISTS financial_records_notes_fts_idx
  ON financial_records
  USING GIN (to_tsvector('english', coalesce(notes, '')));
