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
  type StepId,
} from '../lib/flow.ts';

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
  const announcement = blockedReason && activeId === 'files' && mode === 'run' && activeId === active.id && blockedReason
    ? `Step ${stepIndex(activeId) + 1} of ${RUN_STEPS.length}, ${active.title}, is blocked. ${blockedReason}`
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

  const stepCard = (
      <article className="step-card" aria-labelledby="stepHeading">
        <p className="kicker">{active.kicker}</p>
        <h2 id="stepHeading" tabIndex={-1} ref={headingRef}>{active.title}</h2>
        <p className="step-job">{active.job}</p>
        <p className="step-question">{active.question}</p>
        {blockedReason && (
          <p className="banner" id="stepBlocked">
            This step is blocked. {blockedReason} The counts-only branch is on this step.
          </p>
        )}
        {Children.map(children, (child) => {
          if (!isValidElement(child)) return child;
          const panel = child as ReactElement<{ id?: StepId; hidden?: boolean }>;
          if (panel.props.id === undefined) return child;
          return cloneElement(panel, { hidden: panel.props.id !== activeId });
        })}
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
              Next
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
        {RUN_STEPS.map((step, index) => {
          const status = railStatus(step, facts, activeId, mode);
          const open = canActivate(step, facts, mode);
          const hint = status === 'blocked'
            ? step.blocked(facts)
            : status === 'locked'
              ? step.unlockHint
              : status === 'done'
                ? (mode === 'guide' ? step.guideSummary : step.summary(facts))
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
                  <span className="rail-index">{String(index + 1).padStart(2, '0')}</span>
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
