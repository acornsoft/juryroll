import { useLayoutEffect, useRef } from 'react';
import { CAVEATS, TIER_RULES } from '../../../shared/src/content/copy.ts';

export function LawPage({ topic }: { topic: string | null }) {
  useLayoutEffect(() => {
    const id = topic ? `law-${topic}` : 'law-blackout';
    const node = document.getElementById(id);
    if (node instanceof HTMLDetailsElement) node.open = true;
    if (topic) node?.scrollIntoView();
  }, [topic]);

  return (
    <div className="page" id="lawPage">
      <p className="lede">The check itself is on Run a check. This page is the background: federal timing, what a tier means, and what you can and cannot do.</p>
      <div className="accordion-wrapper-three">
        <details className="sen-acc" id="law-blackout">
          <summary><i className="icon-star" aria-hidden="true" /> Federal 90-day window</summary>
          <div className="acc-body">
            <p>Under the National Voter Registration Act, 52 U.S.C. 20507(c)(2)(A), a state must complete a systematic removal program not later than 90 days before a federal primary or general election. A federal court applied this rule to a program that matched records to find non-citizens: Arcia v. Florida Secretary of State, 772 F.3d 1335 (11th Cir. 2014). The court also said that the rule does not stop removals based on individual information.</p>
            <p><a href="./guide.html">Open the full guide</a></p>
          </div>
        </details>
        <details className="sen-acc" id="law-tiers">
          <summary><i className="icon-star" aria-hidden="true" /> How a tier is chosen</summary>
          <div className="acc-body">
            <ul>
              {TIER_RULES.map((tier) => <li key={tier.name}><b>{tier.name}.</b> {tier.text}</li>)}
            </ul>
          </div>
        </details>
        <details className="sen-acc" id="law-caveats">
          <summary><i className="icon-star" aria-hidden="true" /> Read this before you use a result</summary>
          <div className="acc-body">
            <ul>
              {CAVEATS.map((item) => <li key={item.html} dangerouslySetInnerHTML={{ __html: item.html }} />)}
            </ul>
          </div>
        </details>
        <details className="sen-acc" id="law-challenge">
          <summary><i className="icon-star" aria-hidden="true" /> Private challenges</summary>
          <div className="acc-body">
            <p>A JuryRoll match is a lead for officials. It is not proof. Where the state page quotes a personal-knowledge rule, a match alone does not meet it. Referral is the path.</p>
          </div>
        </details>
        <details className="sen-acc" id="law-use">
          <summary><i className="icon-star" aria-hidden="true" /> Use limits</summary>
          <div className="acc-body">
            <p>State laws about the voter file differ. Read the state walkthrough before you load a file. Send referrals only to the offices named there.</p>
          </div>
        </details>
      </div>
    </div>
  );
}

function FaqItem({ question, answer, startOpen }: { question: string; answer: string; startOpen: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useLayoutEffect(() => {
    if (startOpen && ref.current) ref.current.open = true;
  }, [startOpen]);
  return (
    <details ref={ref} className="faq-item sen-acc">
      <summary><i className="icon-star" aria-hidden="true" /> {question}</summary>
      <p>{answer}</p>
    </details>
  );
}

export function FaqPage() {
  const items = [
    ['What does JuryRoll do?', 'It compares a jury non-citizen list with a voter roll in this browser and sorts leads for official verification.'],
    ['Does any data leave this computer?', 'No. The page makes no network requests. Real voter files stay in the browser.'],
    ['Is a match proof?', 'No. A match is a lead. Only election officials can verify citizenship.'],
    ['Why do some states have no names?', 'When the rules forbid holding the jury list, JuryRoll shows counts and a letter. It does not load the list.'],
    ['Why is a county required?', 'Referrals go to a county board, the chief state election official, or the state attorney general. The letter names the county you select.'],
    ['Can I download the audit log before I pick a county?', 'Yes. The log is your accountability record and has to be available before a purge. The file says so when no county is selected.'],
  ];
  return (
    <div className="page faq-layout" id="faqPage">
      <div className="faq-intro">
        <div className="section-title">
          <p className="kicker">Help</p>
          <h2>Frequently asked questions</h2>
        </div>
        <p>The check runs in this browser. A match is a lead for officials. It is not proof.</p>
        <div className="icon-box-item-02">
          <div className="icon" aria-hidden="true"><i className="icon-check" /></div>
          <div className="content">
            <span className="title">On this computer</span>
            <p>No voter file is uploaded. You can disconnect before you load a file.</p>
          </div>
        </div>
      </div>
      <div className="faq-list accordion-wrapper-three">
        {items.map(([q, a], index) => (
          <FaqItem key={q} question={q} answer={a} startOpen={index === 0} />
        ))}
      </div>
    </div>
  );
}
