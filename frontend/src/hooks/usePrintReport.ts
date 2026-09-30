import { useCallback, useEffect, useState } from "react";

function waitForImages(root: Element): Promise<void> {
  const imgs = [...root.querySelectorAll("img")];
  return Promise.all(
    imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    })
  ).then(() => undefined);
}

/**
 * Mount print sheets only when the user prints, wait for sized photos, then
 * open the browser dialog. Avoids fetching every photo on page load.
 */
export function usePrintReport() {
  const [printReady, setPrintReady] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);

  const startPrint = useCallback(() => {
    if (printReady) {
      window.print();
      return;
    }
    setPrintBusy(true);
    setPrintReady(true);
  }, [printReady]);

  useEffect(() => {
    if (!printReady) return;
    let cancelled = false;
    (async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const root = document.querySelector(".mapping-print-root");
      if (root) {
        await Promise.race([
          waitForImages(root),
          new Promise<void>((resolve) => setTimeout(resolve, 15000)),
        ]);
      }
      if (cancelled) return;
      window.print();
      setPrintBusy(false);
    })();
    const after = () => setPrintReady(false);
    window.addEventListener("afterprint", after);
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", after);
    };
  }, [printReady]);

  return { printReady, printBusy, startPrint };
}
