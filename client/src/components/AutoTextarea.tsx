import { useEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

interface AutoTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> {
  value: string;
}

// A textarea that grows with its content so the full text is always visible
// (no inner scrollbar / clipping). Height is recomputed whenever `value` changes.
export default function AutoTextarea({ value, className, onChange, ...rest }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={className}
      style={{ overflowY: "hidden" }}
      {...rest}
    />
  );
}
