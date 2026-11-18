import { PrismaClient } from "../src/generated/prisma";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { candidates } from "../src/modules/candidates/data";
import { jobs } from "../src/modules/jobs/data";
import { relevanceJudgments } from "../src/modules/evaluation/judgments";
import { skillTaxonomy } from "../src/modules/skills/taxonomy";

function candidateSkillRows(names: string[]) {
  return names.map((name) => ({
    skill: { connect: { id: `skill-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}` } },
  }));
}

function educationRows(candidateId: string, credentials: string[]) {
  return credentials.map((credential, index) => {
    const [qualification, institution] = credential.split(/,\s*/, 2);
    return {
      id: `education-${candidateId}-${String(index + 1).padStart(2, "0")}`,
      credential: qualification,
      institution: institution ?? null,
    };
  });
}

export async function seedDataset(database: PrismaClient) {
  // The deterministic fixture applies many nested upserts atomically and can exceed Prisma's 5s default on local Docker.
  await database.$transaction(async (transaction) => {
    for (const skill of skillTaxonomy) {
      await transaction.skillTaxonomy.upsert({
        where: { id: skill.id },
        update: { name: skill.name, category: skill.category, aliases: skill.aliases, relatedSkills: skill.relatedSkills },
        create: skill,
      });
    }

    for (const candidate of candidates) {
      const experience = candidate.experience.map((record) => ({ ...record }));
      const education = educationRows(candidate.id, candidate.education);
      const certifications = candidate.certifications.map((name, index) => ({
        id: `certification-${candidate.id}-${String(index + 1).padStart(2, "0")}`,
        name,
        issuer: null,
      }));

      await transaction.candidate.upsert({
        where: { id: candidate.id },
        update: {
          name: candidate.name,
          headline: candidate.headline,
          professionalSummary: candidate.professionalSummary,
          originalProfileText: candidate.originalProfileText,
          location: candidate.location,
          workArrangementPreferences: candidate.workArrangementPreferences,
          industries: candidate.industries,
          skills: { deleteMany: {}, create: candidateSkillRows(candidate.skills) },
          experiences: { deleteMany: {}, create: experience },
          projects: { deleteMany: {}, create: candidate.projects },
          education: { deleteMany: {}, create: education },
          certifications: { deleteMany: {}, create: certifications },
          evidence: { deleteMany: {}, create: candidate.evidence },
        },
        create: {
          id: candidate.id,
          name: candidate.name,
          headline: candidate.headline,
          professionalSummary: candidate.professionalSummary,
          originalProfileText: candidate.originalProfileText,
          location: candidate.location,
          workArrangementPreferences: candidate.workArrangementPreferences,
          industries: candidate.industries,
          skills: { create: candidateSkillRows(candidate.skills) },
          experiences: { create: experience },
          projects: { create: candidate.projects },
          education: { create: education },
          certifications: { create: certifications },
          evidence: { create: candidate.evidence },
        },
      });
    }

    for (const job of jobs) {
      const requirements = [...job.mandatoryRequirements, ...job.preferredRequirements].map((item) => ({
        id: item.id,
        description: item.description,
        category: item.category,
        requirementType: item.requirementType,
        importance: item.importance,
        evidenceExpectations: item.evidenceExpectations,
        assessmentCriteria: item.assessmentCriteria,
      }));

      await transaction.job.upsert({
        where: { id: job.id },
        update: {
          title: job.title,
          company: job.company,
          description: job.description,
          industry: job.industry,
          location: job.location,
          workArrangement: job.workArrangement,
          employmentType: job.employmentType,
          seniority: job.seniority,
          experienceExpectations: job.experienceExpectations,
          directDomainAliases: job.directDomainAliases,
          relatedDomainAliases: job.relatedDomainAliases,
          responsibilities: job.responsibilities,
          requirements: { deleteMany: {}, create: requirements },
        },
        create: {
          id: job.id,
          title: job.title,
          company: job.company,
          description: job.description,
          industry: job.industry,
          location: job.location,
          workArrangement: job.workArrangement,
          employmentType: job.employmentType,
          seniority: job.seniority,
          experienceExpectations: job.experienceExpectations,
          directDomainAliases: job.directDomainAliases,
          relatedDomainAliases: job.relatedDomainAliases,
          responsibilities: job.responsibilities,
          requirements: { create: requirements },
        },
      });
    }

    for (const judgment of relevanceJudgments) {
      await transaction.evaluationJudgment.upsert({
        where: { jobId_candidateId: { jobId: judgment.jobId, candidateId: judgment.candidateId } },
        update: {
          relevance: judgment.relevance,
          rationale: judgment.rationale,
          evidenceReferences: judgment.evidenceReferences,
          source: judgment.source,
        },
        create: judgment,
      });
    }
  }, { timeout: 30_000 });

  console.log(`Seeded ${candidates.length} candidates, ${jobs.length} jobs, ${relevanceJudgments.length} relevance judgments, and ${skillTaxonomy.length} canonical skills.`);
}

async function main() {
  const database = new PrismaClient();
  try {
    await seedDataset(database);
  } finally {
    await database.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error("Dataset seed failed.");
    console.error(error);
    process.exitCode = 1;
  });
}
