#!/usr/bin/env python3
"""Extract the curated Mercer benchmark catalog from the protected XLSM source.

This reader intentionally uses only ZIP/XML primitives and never writes to the
source workbook. It skips drawings and macros, which are irrelevant to dMercer.
"""

import argparse
import hashlib
import json
import math
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}

COHORTS = [
    ("J", "region.west", "region"), ("K", "region.midwest", "region"),
    ("L", "region.northeast", "region"), ("M", "region.south", "region"),
    ("N", "size.50-499", "size"), ("O", "size.500-999", "size"),
    ("P", "size.1000-4999", "size"), ("Q", "size.5000-9999", "size"),
    ("R", "size.10000-19999", "size"), ("S", "size.20000-plus", "size"),
    ("T", "national.all", "national"), ("U", "national.500-plus", "national"),
    ("V", "industry.pharmaceuticals", "industry"),
    ("W", "industry.food-beverage", "industry"),
    ("X", "industry.construction", "industry"), ("Y", "industry.energy", "industry"),
    ("Z", "industry.engineering", "industry"),
    ("AA", "industry.legal-services", "industry"),
    ("AB", "industry.higher-education", "industry"),
    ("AC", "industry.school-boards", "industry"),
    ("AD", "industry.hospitals", "industry"),
    ("AE", "industry.health-services", "industry"),
    ("AF", "industry.banks", "industry"),
    ("AG", "industry.real-estate", "industry"),
    ("AH", "industry.high-tech", "industry"),
    ("AI", "industry.biotech", "industry"),
    ("AJ", "industry.nonprofit", "industry"),
    ("AK", "industry.manufacturing", "industry"),
    ("AL", "industry.trade", "industry"), ("AM", "industry.services", "industry"),
    ("AN", "industry.tcu", "industry"),
    ("AO", "industry.health-care", "industry"),
    ("AP", "industry.financial-services", "industry"),
    ("AQ", "industry.government", "industry"),
]


def resolve_target(base, target):
    parts = base.split("/")[:-1]
    for part in target.split("/"):
        if part == "..":
            parts.pop()
        elif part not in ("", "."):
            parts.append(part)
    return "/".join(parts)


def read_sheet(source):
    with zipfile.ZipFile(source) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append("".join(node.text or "" for node in item.iterfind(".//m:t", NS)))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {
            item.attrib["Id"]: resolve_target("xl/workbook.xml", item.attrib["Target"])
            for item in relationships.findall("pr:Relationship", NS)
        }
        sheet_path = None
        for sheet in workbook.findall("m:sheets/m:sheet", NS):
            if sheet.attrib["name"] == "dMercer":
                sheet_path = targets[sheet.attrib[f"{{{NS['r']}}}id"]]
                break
        if not sheet_path:
            raise ValueError("The workbook does not contain a dMercer sheet")

        root = ET.fromstring(archive.read(sheet_path))
        cells = {}
        for cell in root.findall(".//m:c", NS):
            ref = cell.attrib["r"]
            kind = cell.attrib.get("t")
            if kind == "inlineStr":
                cells[ref] = "".join(node.text or "" for node in cell.iterfind(".//m:t", NS))
                continue
            value_node = cell.find("m:v", NS)
            if value_node is None or value_node.text is None:
                continue
            raw = value_node.text
            if kind == "s":
                cells[ref] = shared[int(raw)]
                continue
            if kind == "b":
                cells[ref] = raw == "1"
                continue
            try:
                cells[ref] = int(raw) if re.fullmatch(r"-?\d+", raw) else float(raw)
            except ValueError:
                cells[ref] = raw
        return cells


def availability(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return "available", round(float(value), 6), None
    if isinstance(value, str) and value.strip().upper() == "ID":
        return "insufficient_data", None, value
    if value in (None, ""):
        return "not_reported", None, None
    return "not_reported", None, str(value)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "prisma/data/mercer-2025-manifest.json",
    )
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text())
    cells = read_sheet(args.source)
    if cells.get("B2") != manifest["dataset"]["surveyYear"]:
        raise ValueError("dMercer survey year does not match the manifest")

    cohorts = []
    for order, (column, code, cohort_type) in enumerate(COHORTS, start=1):
        participant = cells.get(f"{column}8")
        cohorts.append({
            "code": code,
            "type": cohort_type,
            "label": str(cells.get(f"{column}6") or cells.get(f"{column}5") or code),
            "shortLabel": str(cells.get(f"{column}7") or cells.get(f"{column}5") or code),
            "sourceColumn": column,
            "participantCount": participant if isinstance(participant, int) else None,
            "sortOrder": order * 10,
        })

    values = []
    warnings = []
    for metric in manifest["metrics"]:
        source_row = metric["sourceRow"]
        if cells.get(f"B{source_row}") is None and cells.get(f"I{source_row}") is None:
            warnings.append(f"Metric {metric['code']} has no source label at row {source_row}")
        for cohort in cohorts:
            source_cell = f"{cohort['sourceColumn']}{source_row}"
            state, numeric, raw = availability(cells.get(source_cell))
            values.append({
                "metricCode": metric["code"],
                "cohortCode": cohort["code"],
                "numericValue": numeric,
                "availability": state,
                "sourceCell": source_cell,
                "rawValue": raw,
            })

    output = {
        "dataset": {
            **manifest["dataset"],
            "sourceFilename": args.source.name,
            "sourceChecksum": hashlib.sha256(args.source.read_bytes()).hexdigest(),
        },
        "cohorts": cohorts,
        "metrics": manifest["metrics"],
        "values": values,
        "warnings": warnings,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(
        f"Extracted {len(output['metrics'])} metrics x {len(cohorts)} cohorts "
        f"({len(values)} values) with {len(warnings)} warning(s)."
    )


if __name__ == "__main__":
    main()
