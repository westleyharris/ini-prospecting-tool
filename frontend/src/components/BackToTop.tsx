import { useEffect, useState } from "react";
import { HiArrowUp } from "react-icons/hi2";

/** Appears after the drawing is scrolled so you can return to the title and tools. */
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 360);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="mapping-screen-only fixed bottom-5 right-5 z-40 flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-navy bg-brand-lime border-2 border-brand-navy shadow-md hover:brightness-110"
      title="Back to top"
    >
      <HiArrowUp className="w-4 h-4" />
      Top
    </button>
  );
}
