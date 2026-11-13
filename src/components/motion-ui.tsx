"use client";

import { useEffect, useRef } from "react";
import { animate, MotionConfig, useReducedMotion } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";

/** Makes every motion component below it honour the OS "reduce motion" setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

const COUNT_UP_SECONDS = 0.9;

/**
 * A number that counts up to its value on first view and glides to new values afterwards.
 * The server renders the final value, so it reads correctly without JavaScript.
 */
export function NumberTicker({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = previous.current;
    previous.current = value;
    if (reduce || from === value) {
      node.textContent = value.toLocaleString("en-US");
      return;
    }
    const controls = animate(from, value, {
      duration: COUNT_UP_SECONDS,
      ease: motionTokens.easing.out,
      onUpdate: (latest) => {
        node.textContent = Math.round(latest).toLocaleString("en-US");
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("en-US")}
    </span>
  );
}
