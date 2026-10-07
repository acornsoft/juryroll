import { useEffect } from 'react';
import { CAVEATS, TIER_RULES } from '../../../shared/src/content/copy.ts';

export function LawPage({ topic }: { topic: string | null }) {
  useEffect(() => {
    if (!topic) return;
    document.getElementById(`law-${topic}`)?.scrollIntoView();
  }, [topic]);

  return (
    <div className="page" id="lawPage">
      <p className="kicker">Background</p>
      <h1>Law and guidance</h1>
      <p className="lede">The check itself is on Run a check. This page is the background: federal timing, what a tier means, and what you can and cannot do.</p>
      <section className="panel" id="law-blackout">
        <h2>Federal 90-day window</h2>
        <p>Under the National Voter Registration Act, 52 U.S.C. 20507(c)(2)(A), a state must complete a systematic removal program not later than 90 days before a federal primary or general election. A federal court applied this rule to a program that matched records to find non-citizens: Arcia v. Florida Secretary of State, 772 F.3d 1335 (11th Cir. 2014). The court also said that the rule does not stop removals based on individual information.</p>
        <p><a href="./guide.html">Open the full guide</a></p>
      </section>
      <section className="panel" id="law-tiers">
        <h2>How a tier is chosen</h2>
        <ul>
          {TIER_RULES.map((tier) => <li key={tier.name}><b>{tier.name}.</b> {tier.text}</li>)}
        </ul>
      </section>
      <section className="panel" id="law-caveats">
        <h2>Read this before you use a result</h2>
        <ul>
          {CAVEATS.map((item) => <li key={item.html} dangerouslySetInnerHTML={{ __html: item.html }} />)}
        </ul>
      </section>
      <section className="panel" id="law-challenge">
        <h2>Private challenges</h2>
        <p>A JuryRoll match is a lead for officials. It is not proof. Where the state page quotes a personal-knowledge rule, a match alone does not meet it. Referral is the path.</p>
      </section>
      <section className="panel" id="law-use">
        <h2>Use limits</h2>
        <p>State laws about the voter file differ. Read the state walkthrough before you load a file. Send referrals only to the offices named there.</p>
      </section>
    </div>
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
    <div className="page" id="faqPage">
      <p className="kicker">Background</p>
      <h1>FAQ</h1>
      <div className="faq-list">
        {items.map(([q, a]) => (
          <details key={q} className="faq-item">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
