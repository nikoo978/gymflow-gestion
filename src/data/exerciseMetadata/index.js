import part1 from "./part1";
import part2 from "./part2";
import part3 from "./part3";
import part4 from "./part4";
import part5 from "./part5";
import part6 from "./part6";
import part7 from "./part7";
import part8 from "./part8";
import part9 from "./part9";
import part10 from "./part10";
import part11 from "./part11";
import part12 from "./part12";

export const EXERCISE_METADATA_BY_ID = {
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5,
  ...part6,
  ...part7,
  ...part8,
  ...part9,
  ...part10,
  ...part11,
  ...part12,
};

export function metadataForLibraryCode(code) {
  const raw = EXERCISE_METADATA_BY_ID[String(code || "")];
  if (!raw) return null;
  return {
    name: String(raw[0] || "").trim(),
    aliases: Array.isArray(raw[1]) ? raw[1].filter(Boolean) : [],
    originalName: String(raw[2] || "").trim(),
  };
}
