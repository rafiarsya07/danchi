"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/app/(app)/actions";

/**
 * A <form> wired to a Server Action: shows the error, resets after success,
 * and tells its children when it's busy (via the submit button's disabled).
 */
export function ActionForm({
  action,
  className,
  children,
  resetOnOk = true,
  okText,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  className?: string;
  children: React.ReactNode;
  resetOnOk?: boolean;
  okText?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(async (prev: ActionResult, form: FormData) => {
    const r = await action(prev, form);
    if (r.ok && resetOnOk) ref.current?.reset();
    return r;
  }, { ok: false });
  const flash = state.ok && !pending && !!okText;
  return (
    <form ref={ref} action={run} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="rounded-xl border-2 border-ink bg-pink-soft px-3 py-1.5 text-sm font-extrabold">
          {state.error}
        </p>
      )}
      {flash && okText && (
        <p role="status" className="pop-in self-start rounded-xl border-2 border-ink bg-mint px-3 py-1.5 text-sm font-extrabold">
          {okText}
        </p>
      )}
    </form>
  );
}

/** A button that runs a (bound) Server Action, optionally after a confirm. */
export function ActButton({
  action,
  children,
  className,
  confirmText,
  label,
  done,
}: {
  action: () => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
  label?: string;
  done?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => {
            const r = await action();
            if (done) setMsg(typeof r === "number" ? done.replace("{n}", String(r)) : done);
          });
        }}
        className={`${className ?? ""} disabled:opacity-50`}
      >
        {children}
      </button>
      {msg && (
        <span role="status" className="pop-in text-xs font-extrabold">
          {msg}
        </span>
      )}
    </>
  );
}
