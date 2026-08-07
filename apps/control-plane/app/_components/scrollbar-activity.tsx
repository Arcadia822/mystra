"use client";

import { useEffect } from "react";

const IDLE_DELAY_MS = 700;

export function ScrollbarActivity() {
  useEffect(() => {
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
    const active = new Set<Element>();

    const clear = (element: Element) => {
      element.removeAttribute("data-scrolling");
      timers.delete(element);
      active.delete(element);
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const existingTimer = timers.get(target);
      if (existingTimer) clearTimeout(existingTimer);
      else {
        target.setAttribute("data-scrolling", "true");
        active.add(target);
      }

      timers.set(target, setTimeout(() => clear(target), IDLE_DELAY_MS));
    };

    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
      active.forEach((element) => {
        const timer = timers.get(element);
        if (timer) clearTimeout(timer);
        element.removeAttribute("data-scrolling");
      });
      active.clear();
    };
  }, []);

  return null;
}
