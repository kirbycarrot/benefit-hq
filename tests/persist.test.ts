import assert from "node:assert/strict";
import test from "node:test";
import { persistCensus } from "@/lib/census/persist";
import type { CensusNormalizeResult } from "@/lib/census/normalize";

function censusResult(
  employeeNumbers: string[],
  postalCodes: Record<string, string> = {}
): CensusNormalizeResult {
  return {
    employees: employeeNumbers.map((employeeNumber) => ({
      employeeNumber,
      firstName: "Test",
      lastName: "Employee",
      postalCode: postalCodes[employeeNumber],
      dependents: [],
      elections: [],
    })),
    warnings: [],
    blocking: false,
    summary: {
      employeeCount: employeeNumbers.length,
      dependentCount: 0,
      electionCount: 0,
      matchedAncillaryCount: 0,
      unmatchedAncillaryCount: 0,
    },
  };
}

function clientProfileTx(committed: { employees: string[]; uploads: string[] }, statesWithEmployees: string[]) {
  const profile = { statesWithEmployees };
  return {
    $queryRaw: async () => [],
    employee: {
      deleteMany: async () => {
        committed.employees = [];
      },
      create: async ({ data }: { data: { employeeNumber: string } }) => {
        committed.employees.push(data.employeeNumber);
      },
    },
    censusUpload: {
      create: async ({ data }: { data: { filenames: string[] } }) => {
        committed.uploads.push(...data.filenames);
        return { id: "upload" };
      },
    },
    planYear: {
      findUnique: async () => ({ clientId: "client-1" }),
    },
    clientProfile: {
      findUnique: async () => ({ statesWithEmployees: profile.statesWithEmployees }),
      update: async ({ data }: { data: { statesWithEmployees: string[] } }) => {
        profile.statesWithEmployees = data.statesWithEmployees;
        return profile;
      },
    },
    profile,
  };
}

test("a failed census replacement rolls back employees and its upload record", async () => {
  const committed = {
    employees: ["existing"],
    uploads: ["existing.xlsx"],
  };

  const client = {
    async $transaction(callback: (tx: unknown) => Promise<unknown>) {
      const draft = structuredClone(committed);
      const tx = {
        $queryRaw: async () => [],
        employee: {
          deleteMany: async () => {
            draft.employees = [];
          },
          create: async ({ data }: { data: { employeeNumber: string } }) => {
            if (data.employeeNumber === "fail") throw new Error("simulated insert failure");
            draft.employees.push(data.employeeNumber);
          },
        },
        censusUpload: {
          create: async ({ data }: { data: { filenames: string[] } }) => {
            draft.uploads.push(...data.filenames);
            return { id: "upload" };
          },
        },
      };

      const result = await callback(tx);
      committed.employees = draft.employees;
      committed.uploads = draft.uploads;
      return result;
    },
  };

  await assert.rejects(
    persistCensus(
      "plan-year",
      censusResult(["new", "fail"]),
      { filenames: ["replacement.xlsx"] },
      client as never
    ),
    /simulated insert failure/
  );

  assert.deepEqual(committed, {
    employees: ["existing"],
    uploads: ["existing.xlsx"],
  });
});

test("a successful census replacement commits data and history together", async () => {
  const committed = { employees: ["existing"], uploads: ["existing.xlsx"] };
  const client = {
    async $transaction(callback: (tx: unknown) => Promise<unknown>) {
      const draft = structuredClone(committed);
      const result = await callback({
        $queryRaw: async () => [],
        employee: {
          deleteMany: async () => {
            draft.employees = [];
          },
          create: async ({ data }: { data: { employeeNumber: string } }) => {
            draft.employees.push(data.employeeNumber);
          },
        },
        censusUpload: {
          create: async ({ data }: { data: { filenames: string[] } }) => {
            draft.uploads.push(...data.filenames);
            return { id: "upload" };
          },
        },
      });
      Object.assign(committed, draft);
      return result;
    },
  };

  await persistCensus(
    "plan-year",
    censusResult(["new-1", "new-2"]),
    { filenames: ["replacement.xlsx"] },
    client as never
  );

  assert.deepEqual(committed, {
    employees: ["new-1", "new-2"],
    uploads: ["existing.xlsx", "replacement.xlsx"],
  });
});

test("committing a census adds newly-seen employee states without dropping existing ones", async () => {
  const committed = { employees: ["existing"], uploads: ["existing.xlsx"] };
  let capturedTx: ReturnType<typeof clientProfileTx> | undefined;

  const client = {
    async $transaction(callback: (tx: unknown) => Promise<unknown>) {
      const tx = clientProfileTx(committed, ["CO"]);
      capturedTx = tx;
      return callback(tx);
    },
  };

  await persistCensus(
    "plan-year",
    censusResult(["ny-1"], { "ny-1": "10001" }),
    { filenames: ["census.xlsx"] },
    client as never
  );

  assert.deepEqual(capturedTx?.profile.statesWithEmployees, ["CO", "NY"]);
});

test("committing a census with no mappable ZIPs leaves the client's states untouched", async () => {
  const committed = { employees: ["existing"], uploads: ["existing.xlsx"] };
  let capturedTx: ReturnType<typeof clientProfileTx> | undefined;

  const client = {
    async $transaction(callback: (tx: unknown) => Promise<unknown>) {
      const tx = clientProfileTx(committed, ["CO"]);
      capturedTx = tx;
      return callback(tx);
    },
  };

  await persistCensus(
    "plan-year",
    censusResult(["no-zip"]),
    { filenames: ["census.xlsx"] },
    client as never
  );

  assert.deepEqual(capturedTx?.profile.statesWithEmployees, ["CO"]);
});
