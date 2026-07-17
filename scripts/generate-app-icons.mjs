import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markPath = path.join(projectRoot, "public/brand/benefit-hq-mark.svg");
const appDirectory = path.join(projectRoot, "src/app");
const publicIconsDirectory = path.join(projectRoot, "public/icons");

const markSvg = await readFile(markPath, "utf8");
const maskableSvg = markSvg
  .replace('rx="128"', 'rx="0"')
  .replace('font-size="194"', 'font-size="210"');

function renderPng(svg, size) {
  return Buffer.from(
    new Resvg(svg, {
      fitTo: { mode: "width", value: size },
      font: { loadSystemFonts: true },
    })
      .render()
      .asPng()
  );
}

function createIco(images) {
  const headerSize = 6;
  const directoryEntrySize = 16;
  const directorySize = directoryEntrySize * images.length;
  let imageOffset = headerSize + directorySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(directorySize);
  images.forEach(({ size, data }, index) => {
    const offset = index * directoryEntrySize;
    directory.writeUInt8(size >= 256 ? 0 : size, offset);
    directory.writeUInt8(size >= 256 ? 0 : size, offset + 1);
    directory.writeUInt8(0, offset + 2);
    directory.writeUInt8(0, offset + 3);
    directory.writeUInt16LE(1, offset + 4);
    directory.writeUInt16LE(32, offset + 6);
    directory.writeUInt32LE(data.length, offset + 8);
    directory.writeUInt32LE(imageOffset, offset + 12);
    imageOffset += data.length;
  });

  return Buffer.concat([header, directory, ...images.map(({ data }) => data)]);
}

await mkdir(publicIconsDirectory, { recursive: true });

const faviconImages = [16, 32, 48, 256].map((size) => ({
  size,
  data: renderPng(markSvg, size),
}));

await Promise.all([
  writeFile(path.join(appDirectory, "favicon.ico"), createIco(faviconImages)),
  writeFile(path.join(appDirectory, "icon.png"), renderPng(markSvg, 512)),
  writeFile(path.join(appDirectory, "apple-icon.png"), renderPng(maskableSvg, 180)),
  writeFile(
    path.join(publicIconsDirectory, "benefit-hq-192.png"),
    renderPng(maskableSvg, 192)
  ),
  writeFile(
    path.join(publicIconsDirectory, "benefit-hq-512.png"),
    renderPng(maskableSvg, 512)
  ),
]);

console.log("Generated Benefit HQ favicon and application icons.");
