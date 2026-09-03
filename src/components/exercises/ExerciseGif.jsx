import { Image as ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const CLOUDINARY_GIF_BASE = "https://res.cloudinary.com/po0pnxfc/image/upload/";

export function exerciseGifCandidates(exercise) {
  const candidates = [];

  for (const url of exercise?.variant_image_urls || []) {
    const value = String(url || "").trim();
    if (value) candidates.push(value);
  }

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
  const candidates = useMemo(() => exerciseGifCandidates(exercise), [exercise?.image_url, exercise?.library_codes, exercise?.variant_image_urls]);
  const signature = candidates.join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => { setIndex(0); }, [signature]);

  if (!candidates.length || index >= candidates.length) {
    return <GifUnavailable />;
  }

  return <img src={candidates[index]} alt={`Demostración de ${exercise?.name || "ejercicio"}`} className={className} loading="lazy" decoding="async" onError={() => setIndex((value) => value + 1)} />;
}

export function ExerciseGifGallery({ exercise, className = "max-h-64 w-full object-contain" }) {
  const candidates = useMemo(() => exerciseGifCandidates(exercise), [exercise?.image_url, exercise?.library_codes, exercise?.variant_image_urls]);
  const signature = candidates.join("|");
  const [failed, setFailed] = useState(() => new Set());

  useEffect(() => { setFailed(new Set()); }, [signature]);

  const visible = candidates.filter((url) => !failed.has(url));
  if (!visible.length) return <GifUnavailable />;

  return (
    <div className={`grid gap-2 ${visible.length > 1 ? "grid-cols-1 min-[420px]:grid-cols-2" : "grid-cols-1"}`}>
      {visible.map((url) => (
        <div key={url} className="overflow-hidden rounded-2xl bg-slate-100">
          <img
            src={url}
            alt={`Demostración de ${exercise?.name || "ejercicio"}`}
            className={className}
            loading="lazy"
            decoding="async"
            onError={() => setFailed((current) => new Set([...current, url]))}
          />
        </div>
      ))}
    </div>
  );
}

function GifUnavailable() {
  return <div className="grid min-h-36 place-items-center p-5 text-center text-slate-400"><div><ImageIcon className="mx-auto size-8" /><p className="mt-2 text-xs font-bold">GIF no disponible</p></div></div>;
}
