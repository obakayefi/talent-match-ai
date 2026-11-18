import { Prisma } from "@/generated/prisma";
import { prisma } from "@/db/prisma";
import type { PreparedRetrievalQuery } from "./query";
import type { RankedRetrievalHit } from "./rrf";

interface LexicalRow {
  candidateId: string;
  candidateName: string;
  headline: string;
  score: number;
  matchedContent: string[];
  evidenceReferences: string[];
}

/** PostgreSQL FTS baseline. Scores are strategy-local and must not be compared with vector scores. */
export async function searchLexically(query: PreparedRetrievalQuery, topK: number): Promise<RankedRetrievalHit[]> {
  const webSearchQuery = query.segments.map((segment) => `(${segment.replace(/[()]/g, " ")})`).join(" OR ");

  const rows = await prisma.$queryRaw<LexicalRow[]>(Prisma.sql`
    WITH search_query AS (
      SELECT websearch_to_tsquery('english', ${webSearchQuery}) AS query
    ), documents AS (
      SELECT c."id" AS "candidateId", c."name" AS "candidateName", c."headline",
             c."headline" AS content, c."id" || '#headline' AS "sourceReference", 'A'::text AS weight
      FROM "Candidate" c
      UNION ALL
      SELECT c."id", c."name", c."headline", c."professionalSummary", c."id" || '#summary', 'B'
      FROM "Candidate" c
      UNION ALL
      SELECT c."id", c."name", c."headline", e."role", e."id" || '#overview', 'A'
      FROM "Candidate" c JOIN "Experience" e ON e."candidateId" = c."id"
      UNION ALL
      SELECT c."id", c."name", c."headline", e."description", e."id" || '#overview', 'B'
      FROM "Candidate" c JOIN "Experience" e ON e."candidateId" = c."id"
      UNION ALL
      SELECT c."id", c."name", c."headline", responsibility.content,
             e."id" || '#responsibility-' || responsibility.ordinality::text, 'A'
      FROM "Candidate" c
      JOIN "Experience" e ON e."candidateId" = c."id"
      CROSS JOIN LATERAL unnest(e."responsibilities") WITH ORDINALITY AS responsibility(content, ordinality)
      UNION ALL
      SELECT c."id", c."name", c."headline", achievement.content,
             e."id" || '#achievement-' || achievement.ordinality::text, 'B'
      FROM "Candidate" c
      JOIN "Experience" e ON e."candidateId" = c."id"
      CROSS JOIN LATERAL unnest(e."achievements") WITH ORDINALITY AS achievement(content, ordinality)
      UNION ALL
      SELECT c."id", c."name", c."headline", s."name", c."id" || '#skill-' || s."name", 'B'
      FROM "Candidate" c JOIN "CandidateSkill" cs ON cs."candidateId" = c."id"
      JOIN "SkillTaxonomy" s ON s."id" = cs."skillId"
      UNION ALL
      SELECT c."id", c."name", c."headline", alias.name, c."id" || '#skill-' || s."name", 'C'
      FROM "Candidate" c JOIN "CandidateSkill" cs ON cs."candidateId" = c."id"
      JOIN "SkillTaxonomy" s ON s."id" = cs."skillId"
      CROSS JOIN LATERAL unnest(s."aliases") AS alias(name)
      UNION ALL
      SELECT c."id", c."name", c."headline",
             p."name" || '. ' || p."description" || '. ' || array_to_string(p."technologies", ', '),
             p."id" || '#description', 'B'
      FROM "Candidate" c JOIN "CandidateProject" p ON p."candidateId" = c."id"
    ), document_scores AS (
      SELECT d.*, ts_rank_cd(setweight(to_tsvector('english', d.content), d.weight::"char"), q.query) AS score
      FROM documents d CROSS JOIN search_query q
      WHERE to_tsvector('english', d.content) @@ q.query
    ), candidate_scores AS (
      SELECT "candidateId", sum(score)::double precision AS score
      FROM document_scores
      GROUP BY "candidateId"
    )
    SELECT c."id" AS "candidateId", c."name" AS "candidateName", c."headline", s.score,
      ARRAY(
        SELECT d.content FROM document_scores d
        WHERE d."candidateId" = c."id"
        ORDER BY d.score DESC, d."sourceReference" ASC LIMIT 3
      ) AS "matchedContent",
      ARRAY(
        SELECT DISTINCT d."sourceReference" FROM document_scores d
        WHERE d."candidateId" = c."id"
        ORDER BY d."sourceReference" ASC LIMIT 5
      ) AS "evidenceReferences"
    FROM candidate_scores s JOIN "Candidate" c ON c."id" = s."candidateId"
    ORDER BY s.score DESC, c."id" ASC
    LIMIT ${topK}
  `);

  return rows.map((row, index) => ({
    candidateId: row.candidateId,
    candidateName: row.candidateName,
    headline: row.headline,
    rank: index + 1,
    score: Number(row.score),
    matchedContent: row.matchedContent,
    evidenceReferences: row.evidenceReferences,
  }));
}
