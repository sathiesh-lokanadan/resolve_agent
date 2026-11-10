-- Knowledge-base articles with one gte-small embedding (384 dimensions) per article.
create extension if not exists vector;

create table if not exists kb_articles (
  id        text primary key,
  title     text not null,
  category  text not null,
  tags      text[] not null default '{}',
  body      text not null,
  embedding vector(384) not null
);

-- Only the server (service role) reads this table. With RLS on and no policies,
-- the public anon key sees nothing.
alter table kb_articles enable row level security;

create index if not exists kb_articles_embedding_idx
  on kb_articles using hnsw (embedding vector_cosine_ops);

-- Closest articles by cosine similarity (1 = identical direction, 0 = unrelated).
create or replace function match_kb_articles(
  query_embedding vector(384),
  match_count     int   default 3,
  min_similarity  float default 0
)
returns table (id text, title text, category text, body text, similarity float)
language sql stable
as $$
  select a.id, a.title, a.category, a.body,
         1 - (a.embedding <=> query_embedding) as similarity
  from kb_articles a
  where 1 - (a.embedding <=> query_embedding) >= min_similarity
  order by a.embedding <=> query_embedding
  limit least(match_count, 10);
$$;
