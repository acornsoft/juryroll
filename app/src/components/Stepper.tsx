import { Children, cloneElement, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import {
  RUN_STEPS,
  canActivate,
  nextStepId,
  previousStepId,
  railStatus,
  stepById,
  stepIndex,
  type FlowFacts,
  type FlowMode,
  type RailStatus,
  type StepDef,
  type StepId,
} from '../lib/flow.ts';

function blockLine(facts: FlowFacts): string {
  if (facts.allowJuryList) return `${facts.stateName}: jury list allowed. Matches go to a confidential referral.`;
  return `${facts.stateName}: counts only. JuryRoll can't load the jury list here.`;
}

function lockedHint(id: StepId): string {
  switch (id) {
    case 'where':
      return 'Always open';
    case 'sign':
      return 'Choose a state';
    case 'files':
      return 'Sign first';
    case 'run':
      return 'Needs both files';
    case 'triage':
      return 'After the match';
    case 'export':
      return 'Finish triage';
    default: {
      const missing: never = id;
      return missing;
    }
  }
}

function runRailHint(step: StepDef, status: RailStatus, facts: FlowFacts): string {
  switch (status) {
    case 'blocked':
      return 'Counts only';
    case 'locked':
      return lockedHint(step.id);
    case 'done':
      return step.summary(facts);
    case 'active':
      return 'Current step';
    default: {
      const neverStatus: never = status;
      return neverStatus;
    }
  }
}

export function StepPanel({ id, hidden, children }: { id: StepId; hidden?: boolean; children: ReactNode }) {
  return (
    <div id={`step-panel-${id}`} hidden={hidden}>
      {children}
    </div>
  );
}

type StepperProps = {
  facts: FlowFacts;
  activeId: StepId;
  mode?: FlowMode;
  notice?: string;
  nextEnabled?: boolean;
  onActivate: (id: StepId) => void;
  guideStartHref?: string;
  companion?: ReactNode;
  children: ReactNode;
};

export function Stepper({
  facts,
  activeId,
  mode = 'run',
  notice = '',
  nextEnabled = false,
  onActivate,
  guideStartHref,
  companion,
  children,
}: StepperProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipFocus = useRef(true);
  const active = stepById(activeId);
  const blockedReason = active.blocked(facts);
  const showNext = mode === 'guide'
    ? stepIndex(activeId) < RUN_STEPS.length - 1
    : active.advance === 'next' && !blockedReason;
  const showStart = mode === 'guide' && stepIndex(activeId) === RUN_STEPS.length - 1 && Boolean(guideStartHref);
  const prev = previousStepId(activeId);
  const announcement = blockedReason && mode === 'run'
    ? `Step ${stepIndex(activeId) + 1} of ${RUN_STEPS.length}, ${active.title}. ${blockLine(facts)}`
    : `Step ${stepIndex(activeId) + 1} of ${RUN_STEPS.length}, ${active.title}. ${active.question}`;

  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [activeId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      if (!event.altKey) return;
      if (event.key === 'ArrowLeft' && prev) {
        event.preventDefault();
        go(prev);
      }
      if (event.key === 'ArrowRight' && showNext && (mode === 'guide' || nextEnabled)) {
        event.preventDefault();
        const id = nextStepId(activeId, facts, mode);
        if (id) go(id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function go(id: StepId) {
    const step = stepById(id);
    if (!canActivate(step, facts, mode)) return;
    onActivate(id);
  }

  const nextInOrder = showNext ? RUN_STEPS[stepIndex(activeId) + 1] : undefined;
  const nextLabel = mode === 'run' && nextInOrder ? `Next: ${nextInOrder.title}` : 'Next';

  const stepCard = (
      <article className="step-card" aria-labelledby="stepHeading">
        <div className="step-scroll">
        <p className="kicker">{mode === 'run' ? `Step ${stepIndex(activeId) + 1} of ${RUN_STEPS.length}` : active.kicker}</p>
        <h2 id="stepHeading" tabIndex={-1} ref={headingRef}>{active.title}</h2>
        <p className="step-job">{active.job}</p>
        <p className="step-question">{active.question}</p>
        {mode === 'run' && (
          <ul className="done-rows">
            {RUN_STEPS.filter((step) => stepIndex(step.id) < stepIndex(activeId) && step.complete(facts)).map((step) => (
              <li key={step.id}>
                <button type="button" className="done-row" onClick={() => go(step.id)}>
                  <span className="done-check" aria-hidden="true">✓</span>
                  <span className="done-name">{step.title}</span>
                  <span className="done-sum">{step.summary(facts)}</span>
                  <span className="done-edit">{step.id === 'where' ? 'Edit' : 'View'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {mode === 'run' && blockedReason && (
          <div className="banner" id="stepBlocked">
            <p>{blockLine(facts)}</p>
            <details className="basis-why">
              <summary>Why?</summary>
              <p id="stepBasis">{blockedReason}</p>
            </details>
          </div>
        )}
        {Children.map(children, (child) => {
          if (!isValidElement(child)) return child;
          const panel = child as ReactElement<{ id?: StepId; hidden?: boolean }>;
          if (panel.props.id === undefined) return child;
          return cloneElement(panel, { hidden: panel.props.id !== activeId });
        })}
        </div>
        <div className="step-actions">
          {prev && (
            <button type="button" id="stepBack" className="quiet" onClick={() => go(prev)}>Back</button>
          )}
          {showNext && (
            <button
              type="button"
              id="stepNext"
              className="btn-primary"
              disabled={mode === 'run' && !nextEnabled}
              onClick={() => {
                const id = nextStepId(activeId, facts, mode);
                if (id) go(id);
              }}
            >
              {nextLabel}
            </button>
          )}
          {showStart && guideStartHref && (
            <a className="btn-primary" href={guideStartHref}>Start a check in {facts.stateName}</a>
          )}
        </div>
      </article>
    );

  return (
    <div className={`stepper-block mode-${mode}${companion ? ' has-map' : ''}`}>
      <ol className="rail" id="stepper" aria-label="Check progress">
        {mode === 'run' && (
          <li className="rail-phone">
            <span className="rail-phone-now">{stepIndex(activeId) + 1} · {active.title}</span>
            <span className="rail-phone-of">Step {stepIndex(activeId) + 1} of {RUN_STEPS.length}</span>
          </li>
        )}
        {RUN_STEPS.map((step, index) => {
          const status = railStatus(step, facts, activeId, mode);
          const open = canActivate(step, facts, mode);
          const hint = mode === 'run'
            ? runRailHint(step, status, facts)
            : status === 'blocked'
              ? 'Counts only'
              : status === 'locked'
                ? step.unlockHint
                : status === 'done'
                  ? step.guideSummary
                  : null;
          return (
            <li key={step.id} className={`rail-item action-single-items is-${status}`}>
              <button
                type="button"
                id={`step-tab-${step.id}`}
                className="rail-btn"
                aria-current={step.id === activeId ? 'step' : undefined}
                aria-disabled={open ? undefined : true}
                disabled={!open}
                onClick={() => go(step.id)}
              >
                <span className="action-shape" aria-hidden="true">
                  <span className="rail-index">{mode === 'run' && status === 'done' ? '✓' : String(index + 1)}</span>
                </span>
                <span className="rail-copy">
                  <span className="rail-title">{step.title}</span>
                  <span className="rail-state">{status}</span>
                  {hint && <span className="rail-hint">{hint}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p id="stepLive" className="visually-hidden" aria-live="polite">{announcement}</p>
      {notice && <p className="note" id="invalidateNote" role="status">{notice}</p>}
      {companion ? (
        <div className="workflow-split">
          {stepCard}
          <aside className="workflow-map" aria-label="County map">
            {companion}
          </aside>
        </div>
      ) : stepCard}
    </div>
  );
}
