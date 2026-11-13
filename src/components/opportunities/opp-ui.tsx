"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveOpportunity } from "@/app/(app)/opportunities/actions";
import { cls, FormMessage, SubmitButton } from "@/components/ui";
import { OPP_STATUS_LABELS, OPP_STATUSES, OPP_TYPES } from "@/lib/opportunity-meta";
import type { Opportunity } from "@/lib/queries/opportunities";

export function OppForm({ opp, compact = false }: { opp?: Opportunity; compact?: boolean }) {
  const [state, action] = useActionState(saveOpportunity, null);
  const formRef = useRef<HTMLFormElement>(null);
  const key = opp?.id ?? "new";

  useEffect(() => {
    if (state?.ok && !opp) formRef.current?.reset();
  }, [state, opp]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      {opp ? <input type="hidden" name="id" value={opp.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className={cls.label} htmlFor={`o-name-${key}`}>
            Name
          </label>
          <input id={`o-name-${key}`} name="name" required maxLength={200} defaultValue={opp?.name} placeholder="Smart India Hackathon, Google STEP…" className={cls.input} />
        </div>
        <div>
          <label className={cls.label} htmlFor={`o-type-${key}`}>
            Type
          </label>
          <input id={`o-type-${key}`} name="type" list={`o-types-${key}`} maxLength={60} placeholder="Internship, hackathon…" defaultValue={opp?.type ?? ""} className={cls.input} />
          <datalist id={`o-types-${key}`}>
            {OPP_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={cls.label} htmlFor={`o-deadline-${key}`}>
            Deadline
          </label>
          <input id={`o-deadline-${key}`} name="deadline" type="date" defaultValue={opp?.deadline ?? ""} className={cls.input} />
        </div>
      </div>
      {!compact ? (
        <>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
            <div>
              <label className={cls.label} htmlFor={`o-status-${key}`}>
                Stage
              </label>
              <select id={`o-status-${key}`} name="status" defaultValue={opp?.status ?? "inbox"} className={`${cls.select} w-full`}>
                {OPP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {OPP_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cls.label} htmlFor={`o-link-${key}`}>
                Link
              </label>
              <input id={`o-link-${key}`} name="link" maxLength={4096} defaultValue={opp?.link ?? ""} placeholder="https://…" className={cls.input} />
            </div>
          </div>
          <div>
            <label className={cls.label} htmlFor={`o-next-${key}`}>
              Next action
            </label>
            <input id={`o-next-${key}`} name="nextAction" maxLength={300} defaultValue={opp?.nextAction ?? ""} placeholder="Finish SOP draft, ask Prof. for LOR…" className={cls.input} />
          </div>
          <div>
            <label className={cls.label} htmlFor={`o-notes-${key}`}>
              Notes
            </label>
            <textarea id={`o-notes-${key}`} name="notes" rows={6} maxLength={10_000} defaultValue={opp?.notes ?? ""} className={cls.textarea} />
          </div>
        </>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">{opp ? "Save" : "Add opportunity"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
