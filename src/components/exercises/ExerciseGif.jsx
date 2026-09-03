import { Image as ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CLOUDINARY_GIF_BASE = "https://res.cloudinary.com/po0pnxfc/image/upload/";

export function exerciseGifCandidates(exercise) {
  const candidates = [];
  const imageUrl = String(exercise?.image_url || "").trim();
  if (imageUrl) candidates.push(imageUrl);

  for (const code of exercise?.library_codes || []) {
    const normalized = Number(code);
    if (Number.isInteger(normalized) && normalized > 0) {
      candidates.push(`${CLOUDINARY_GIF_BASE}${normalized}.gif`);
    }
  }

  return [...new Set(candidates)];
}

export default function ExerciseGif({ exercise, className = "max-h-64 w-full object-contain" }) {
  const candidates = useMemo(() => exerciseGifCandidates(exercise), [exercise?.image_url, exercise?.library_codes]);
  const signature = candidates.join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => { setIndex(0); }, [signature]);

  if (!candidates.length || index >= candidates.length) {
    return <div className="grid min-h-36 place-items-center p-5 text-center text-slate-400"><div><ImageIcon className="mx-auto size-8" /><p className="mt-2 text-xs font-bold">GIF no disponible</p></div></div>;
  }

  return <img src={candidates[index]} alt={`Demostración de ${exercise?.name || "ejercicio"}`} className={className} loading="lazy" decoding="async" onError={() => setIndex((value) => value + 1)} />;
}
