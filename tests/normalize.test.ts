import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCensus } from "@/lib/census/normalize";
import type { ParsedSheet } from "@/lib/census/parseWorkbook";

test("normalization joins ancillary elections in memory and discards SSNs", () => {
  const sheets: ParsedSheet[] = [
    {
      name: "Medical Dental Vision",
      headerRow: [
        "Employee Number",
        "Employee SSN",
        "Employee First Name",
        "Employee Last Name",
        "Employee Birth Date",
        "Employee Gender",
        "Ben Plan Type Name",
        "Ben Plan Name",
        "Ben Plan Option Name",
      ],
      dataRows: [
        ["E-1", "111-22-3333", "Avery", "Broker", new Date("1980-01-02"), "F", "Health", "PPO", "EE"],
      ],
    },
    {
      name: "Life STD LTD",
      headerRow: ["Member Name", "Member SSN", "Basic Term Life Volume"],
      dataRows: [["Avery Broker", "111223333", 50_000]],
    },
  ];

  const result = normalizeCensus(sheets);

  assert.equal(result.blocking, false);
  assert.equal(result.summary.employeeCount, 1);
  assert.equal(result.summary.matchedAncillaryCount, 1);
  assert.deepEqual(result.employees[0].elections, [
    { benefitType: "Medical", planName: "PPO", optionName: "EE" },
    { benefitType: "Life", volume: 50_000 },
  ]);
  assert.equal("ssn" in result.employees[0], false);
});

test("normalization blocks a workbook without a recognizable census sheet", () => {
  const result = normalizeCensus([]);
  assert.equal(result.blocking, true);
  assert.equal(result.employees.length, 0);
});
