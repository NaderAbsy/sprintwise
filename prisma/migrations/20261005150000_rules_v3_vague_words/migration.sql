-- Rules v3 adds vague words to the default list. Projects still on the old
-- default get the new one; projects with their own list keep it.
UPDATE "projects"
SET "vagueWords" = ARRAY['fast', 'quick', 'quickly', 'easy', 'easily', 'simple', 'user-friendly', 'secure', 'efficient', 'intuitive', 'flexible', 'robust', 'seamless', 'seamlessly', 'scalable', 'appropriate', 'adequate', 'as needed', 'and/or', 'etc', 'works', 'properly', 'correctly', 'as expected', 'better', 'improve', 'improved', 'optimize', 'optimise', 'handle', 'stuff', 'things', 'something', 'somehow', 'nice', 'good', 'various', 'relevant']::TEXT[]
WHERE "vagueWords" = ARRAY['fast', 'quick', 'quickly', 'easy', 'easily', 'simple', 'user-friendly', 'secure', 'efficient', 'intuitive', 'flexible', 'robust', 'seamless', 'seamlessly', 'scalable', 'appropriate', 'adequate', 'as needed', 'and/or', 'etc']::TEXT[];
