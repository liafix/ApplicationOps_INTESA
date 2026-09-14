import { prisma } from "../lib/db/prisma";
import { resetSyntheticScenario, readSyntheticScenario } from "../lib/db/synthetic-scenario-store";

async function main() {
  await resetSyntheticScenario(prisma);
  const scenario = await readSyntheticScenario(prisma);

  if (!scenario) throw new Error("Synthetic ApplicationOps scenario was not created.");

  console.log(
    `Seeded ${scenario.id}: ${scenario.status}, release ${scenario.application.activeReleaseVersion}, validation ${scenario.validationChecks.filter((check) => check.status === "PASS").length}/${scenario.validationChecks.length}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
