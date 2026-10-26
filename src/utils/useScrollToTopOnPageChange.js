import { useEffect, useRef } from "react";

/**
 * Сбрасывает прокрутку к началу при смене страницы пагинации.
 * Работает и для window, и для внутренних контейнеров с overflow.
 * Не срабатывает при первом рендере и при прочих ререндерах.
 *
 * @param {number|string} page — текущая страница.
 * @param {object} [options]
 * @param {React.RefObject<boolean>} [options.skipRef] — если true, сброс пропускается (для восстановления страницы).
 */
export function useScrollToTopOnPageChange(page, { skipRef = null } = {}) {
  const didMountRef = useRef(false);
  const prevPageRef = useRef(page);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      prevPageRef.current = page;
      return;
    }
    if (prevPageRef.current === page) return;
    prevPageRef.current = page;

    if (skipRef?.current) {
      skipRef.current = false;
      return;
    }

    requestAnimationFrame(() => {
      // 1. window
      window.scrollTo({ top: 0, behavior: "auto" });

      // 2. любой внутренний контейнер, у которого scrollTop > 0
      const all = document.querySelectorAll("*");
      for (const el of all) {
        if (el.scrollTop > 0) {
          el.scrollTop = 0;
        }
      }
    });
  }, [page, skipRef]);
}