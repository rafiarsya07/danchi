"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Icon } from "@/components/icon";
import { deleteTask, toggleTask } from "@/app/(app)/actions";

export function TaskCheck({
  id,
  title,
  done,
  meta,
  readOnly,
  showDelete,
}: {
  id: string;
  title: string;
  done: boolean;
  meta?: string;
  readOnly?: boolean;
  showDelete?: boolean;
}) {
  const [optimisticDone, setOptimistic] = useOptimistic(done);
  const [pending, start] = useTransition();

  return (
    <div className={`flex min-h-11 items-center gap-2.5 ${pending ? "opacity-70" : ""}`}>
      <button
        type="button"
        disabled={readOnly}
        aria-label={`${optimisticDone ? "Undo" : "Done"}: ${title}`}
        onClick={() =>
          start(async () => {
            setOptimistic(!optimisticDone);
            await toggleTask(id);
          })
        }
        className="-ml-2 flex size-11 shrink-0 items-center justify-center disabled:cursor-default"
      >
        <span
          className={`flex size-[26px] items-center justify-center rounded-[9px] border-[2.5px] border-ink ${
            optimisticDone ? "bg-mint" : "bg-white"
          }`}
        >
          {optimisticDone && <Icon name="check" size={14} stroke={3.4} />}
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        {showDelete && !readOnly ? (
          <Link href={`/tasks/${id}`} className={`truncate text-[15px] font-extrabold underline-offset-2 hover:underline ${optimisticDone ? "line-through opacity-55" : ""}`}>
            {title}
          </Link>
        ) : (
          <span className={`truncate text-[15px] font-extrabold ${optimisticDone ? "line-through opacity-55" : ""}`}>{title}</span>
        )}
        {meta && <span className="text-xs font-bold text-ink-soft">{meta}</span>}
      </div>
      {showDelete && !readOnly && (
        <button
          type="button"
          aria-label={`Delete ${title}`}
          onClick={() => start(() => deleteTask(id))}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-pink-soft"
        >
          <Icon name="trash" size={19} />
        </button>
      )}
    </div>
  );
}
