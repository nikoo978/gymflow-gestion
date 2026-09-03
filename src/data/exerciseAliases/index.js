import part1 from "./part1";
import part2 from "./part2";
import part3 from "./part3";
import part4 from "./part4";
import part5 from "./part5";
import part6 from "./part6";

export const EXERCISE_ALIASES_BY_ID = { ...part1, ...part2, ...part3, ...part4, ...part5, ...part6 };

export function aliasesForLibraryCodes(codes = []) {
  const seen = new Set();
  const aliases = [];

  for (const code of codes || []) {
    const raw = EXERCISE_ALIASES_BY_ID[String(code)] || "";
    for (const value of raw.split(";")) {
      const alias = value.trim();
      const key = alias.toLocaleLowerCase("es");
      if (!alias || seen.has(key)) continue;
      seen.add(key);
      aliases.push(alias);
    }
  }

  return aliases;
}
