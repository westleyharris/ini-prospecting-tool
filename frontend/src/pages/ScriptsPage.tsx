import { useState } from "react";

type ScriptTab = "gatekeeper" | "decision_maker";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function ScriptLine({ speaker, text, note }: { speaker?: string; text: string; note?: string }) {
  return (
    <div className="space-y-0.5">
      {speaker && (
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{speaker}</p>
      )}
      <p className="text-gray-800 leading-relaxed">{text}</p>
      {note && (
        <p className="text-xs text-amber-600 italic mt-0.5">{note}</p>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-gray-100" />
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

function ObjectionBlock({ trigger, response }: { trigger: string; response: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">"{trigger}"</span>
        <span className="text-gray-400 text-lg leading-none ml-2">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-700 leading-relaxed">{response}</p>
        </div>
      )}
    </div>
  );
}

function KeyPoint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-gray-700">
      <span className="text-blue-500 font-bold mt-0.5 shrink-0">→</span>
      <span>{children}</span>
    </div>
  );
}

// ─── Gatekeeper Script ────────────────────────────────────────────────────────

const GATEKEEPER_SCRIPT = `Opening:
"Hi, I'm [Your Name] calling from I&I Automation in Rockwall, Texas."

"I'm trying to reach whoever handles maintenance or controls at your facility — usually that's a Maintenance Manager or Controls Engineer. Is there someone like that I could speak with?"

If transferred — great. Ask for their name before they patch you through.

If they ask what it's about:
"We do industrial controls work — PLCs, HMIs, that kind of thing. We work with a lot of manufacturing plants in the area and I just wanted to introduce ourselves and see if we might be useful to your team."

If they say he's busy or unavailable:
"No problem at all. Could I get his name? I'll try reaching out a different way."

If they won't give a name:
"Understood. Is there a maintenance department line or email I could send something to? I'll keep it short."

Always end with:
"Thank you, I really appreciate your help."`;

const DECISION_MAKER_SCRIPT = `Opening:
"Hi [Name], my name is [Your Name] — I'm with I&I Automation out of Rockwall, TX, about [X] miles from you."

"I'll be straight with you — I'm not calling to pitch anything today."

"We do industrial controls work — PLCs, HMIs, VFDs, SCADA — mainly on Allen-Bradley and Siemens systems. We work with manufacturing plants in the region."

The question:
"Quick question for you — when you have a controls problem, a PLC fault or an HMI that goes down, who do you call?"

[Listen — this is the most important part of the call]

If they have a vendor / integrator:
"Good to know. How's that working out for you? How fast can they typically get someone on-site?"

If they struggle to answer / use the OEM / nobody local:
"That's actually exactly why I'm calling."

The offer:
"We do something we call a Controls Risk Assessment — it's free, takes about 30 minutes on-site. We look at what you're running, what's backed up, what's not documented, where your biggest exposure is if something goes down hard."

"There's no pitch at the end. You just get a clear picture of where you stand. A lot of maintenance managers find it useful even when they don't end up working with us."

The ask:
"Would it be worth 30 minutes? I can come to you — whatever's easiest."`;

function GatekeeperScript() {
  return (
    <div className="space-y-6">
      {/* Goal banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 space-y-1">
        <p className="text-sm font-semibold text-blue-800">Goal of this call</p>
        <p className="text-sm text-blue-700">Get a name and direct contact (or extension) for the maintenance manager, controls engineer, or plant manager. A transfer is ideal but not required.</p>
      </div>

      {/* Before you call */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Before you dial</p>
        <div className="space-y-1.5">
          <KeyPoint>Know the plant name and rough location</KeyPoint>
          <KeyPoint>Have a notepad ready — you need to write down the name they give you</KeyPoint>
          <KeyPoint>Don't mention "sales" or "proposal" — you're introducing yourself</KeyPoint>
          <KeyPoint>Sound like you belong there, not like a cold caller</KeyPoint>
        </div>
      </div>

      {/* Script */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">The script</p>
          <CopyButton text={GATEKEEPER_SCRIPT} />
        </div>
        <div className="px-5 py-5 space-y-5 text-sm">

          <ScriptLine
            speaker="You"
            text={`"Hi, I'm [Your Name] calling from I&I Automation in Rockwall, Texas."`}
          />
          <ScriptLine
            text={`"I'm trying to reach whoever handles maintenance or controls at your facility — usually that's a Maintenance Manager or Controls Engineer. Is there someone like that I could speak with?"`}
            note="Pause and let them respond. Don't fill the silence."
          />

          <Divider label="If they ask what it's about" />

          <ScriptLine
            speaker="You"
            text={`"We do industrial controls work — PLCs, HMIs, that kind of thing. We work with manufacturing plants in the area and I just wanted to introduce ourselves and see if we might be useful to your team."`}
            note="Keep it short. The front desk doesn't need the full story."
          />

          <Divider label="If they transfer you" />

          <ScriptLine
            speaker="You"
            text={`"Before you put me through — could I get his name just in case I miss him?"`}
            note="Always get the name before the transfer. If it goes to voicemail you'll need it."
          />

          <Divider label="If he's busy / unavailable" />

          <ScriptLine
            speaker="You"
            text={`"No problem at all. Could I get his name? I'll try reaching out a different way."`}
          />

          <Divider label="If they won't give a name" />

          <ScriptLine
            speaker="You"
            text={`"Understood. Is there a maintenance department line or an email address I could send something to? I'll keep it short."`}
          />

          <Divider label="Always end with" />

          <ScriptLine
            speaker="You"
            text={`"Thank you — I really appreciate your help."`}
          />
        </div>
      </div>

      {/* Objection handlers */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700 px-1">Objection handlers</p>
        <ObjectionBlock
          trigger="We're not interested."
          response={`"Totally fair — I'm not trying to sell you anything on this call. I'm just trying to find out who handles maintenance so I can send them a quick note. Could I get that person's name?"`}
        />
        <ObjectionBlock
          trigger="Put it in an email to info@..."
          response={`"Happy to. Who should I address it to? I want to make sure it goes to the right person rather than a general inbox."`}
        />
        <ObjectionBlock
          trigger="We already have a vendor for that."
          response={`"Good to know. I'm not looking to replace anyone — I'm just introducing ourselves as a local option for when you need backup support or additional capacity. Could I still get the maintenance manager's name?"`}
        />
        <ObjectionBlock
          trigger="He doesn't take calls from vendors."
          response={`"Understood — I won't bother him by phone. Could I get his name so I can send a short email instead? I'll keep it to two sentences."`}
        />
      </div>

      {/* After the call */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-2">
        <p className="text-sm font-semibold text-amber-800">Log it immediately after hanging up</p>
        <div className="space-y-1">
          <KeyPoint>Name you got</KeyPoint>
          <KeyPoint>Direct number or extension if you got one</KeyPoint>
          <KeyPoint>Whether you got transferred or not</KeyPoint>
          <KeyPoint>Best time to call back if they said</KeyPoint>
        </div>
      </div>
    </div>
  );
}

// ─── Decision Maker Script ────────────────────────────────────────────────────

function DecisionMakerScript() {
  return (
    <div className="space-y-6">
      {/* Goal banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 space-y-1">
        <p className="text-sm font-semibold text-emerald-800">Goal of this call</p>
        <p className="text-sm text-emerald-700">Get them to agree to a 30-minute on-site Controls Risk Assessment. That's the only ask. Not a full meeting, not a proposal — just a walk-through.</p>
      </div>

      {/* Mindset */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Before you dial</p>
        <div className="space-y-1.5">
          <KeyPoint>You know their name — use it immediately</KeyPoint>
          <KeyPoint>Lead with a question, not a pitch. Let them talk first.</KeyPoint>
          <KeyPoint>The most important thing you'll learn: who they call when something breaks</KeyPoint>
          <KeyPoint>If they have nobody good locally — that's your opening</KeyPoint>
          <KeyPoint>The offer is free and low-risk — they have nothing to lose by saying yes</KeyPoint>
        </div>
      </div>

      {/* Script */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">The script</p>
          <CopyButton text={DECISION_MAKER_SCRIPT} />
        </div>
        <div className="px-5 py-5 space-y-5 text-sm">

          <ScriptLine
            speaker="You — Opening"
            text={`"Hi [Name], my name is [Your Name] — I'm with I&I Automation out of Rockwall, TX, about [X] miles from you."`}
          />
          <ScriptLine
            text={`"I'll be straight with you — I'm not calling to pitch anything today."`}
            note="This line disarms them. Almost nobody says this."
          />
          <ScriptLine
            text={`"We do industrial controls work — PLCs, HMIs, VFDs, SCADA — mainly on Allen-Bradley and Siemens systems. We work with manufacturing plants in the region."`}
          />

          <Divider label="The question — most important part" />

          <ScriptLine
            speaker="You"
            text={`"Quick question for you — when you have a controls problem, a PLC fault or an HMI that goes down, who do you call?"`}
            note="Stop talking. Wait for the answer. This question tells you everything."
          />

          <Divider label="If they have a vendor or integrator" />

          <ScriptLine
            speaker="You"
            text={`"Good to know. How's that working out? How fast can they typically get someone on-site when something goes down hard?"`}
            note="You're listening for frustration — slow response times, high cost, they have to wait days. That's your opening."
          />

          <Divider label="If they struggle to answer / no local support / use OEM" />

          <ScriptLine
            speaker="You"
            text={`"That's actually exactly why I'm calling."`}
          />

          <Divider label="The offer" />

          <ScriptLine
            speaker="You"
            text={`"We do something we call a Controls Risk Assessment — it's free, takes about 30 minutes on-site. We look at what you're running, what's backed up, what's not documented, and where your biggest exposure is if something goes down hard."`}
          />
          <ScriptLine
            text={`"There's no pitch at the end. You just get a clear picture of where you stand. A lot of maintenance managers find it useful even when they don't end up working with us."`}
            note="This kills the 'I'll just be sold to' objection before they raise it."
          />

          <Divider label="The ask" />

          <ScriptLine
            speaker="You"
            text={`"Would it be worth 30 minutes? I can come to you — whatever's easiest for your schedule."`}
            note="Small ask, you're going to them, no commitment. Make it as easy as possible to say yes."
          />

        </div>
      </div>

      {/* Objection handlers */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700 px-1">Objection handlers</p>
        <ObjectionBlock
          trigger="We're not looking for any new vendors right now."
          response={`"Completely understand — this isn't a vendor pitch. Think of it more like a second set of eyes on your controls setup. The assessment is free, no strings attached, and you keep whatever we find. If you're not dealing with any controls exposure right now, we'll say so. Would 30 minutes be worth knowing either way?"`}
        />
        <ObjectionBlock
          trigger="We already have an integrator we use."
          response={`"Good — you should. I'm not here to replace them. We work with plants as a local backup resource and for projects their primary integrator is too busy or too far for. Is your current integrator local to you?"`}
        />
        <ObjectionBlock
          trigger="Send me something by email."
          response={`"Happy to. Can I ask — what would make it worth actually reading? Because I can send you a one-pager, but honestly a 30-minute walk-through would show you more than anything I can put in an email. If I sent you something, what would you want to see in it?"`}
        />
        <ObjectionBlock
          trigger="We don't have budget for anything right now."
          response={`"The assessment is completely free — no cost, no contract. I'm not asking you to spend anything. I'm asking for 30 minutes so we can both figure out whether there's a reason to talk further. Would that work?"`}
        />
        <ObjectionBlock
          trigger="I'm too busy right now."
          response={`"Totally get it. When does it slow down a little? I can work around your schedule — early morning, end of shift, whatever works. I'll come to you."`}
        />
        <ObjectionBlock
          trigger="We handle everything in-house."
          response={`"Respect that. Quick question — what's your PLC backup situation like? And do you have someone who can recover your HMI program from scratch if the drive fails? That's where most in-house teams have the most exposure. If you're solid on that, we're probably not a fit right now — but it might be worth a 20-minute look just to confirm."`}
        />
      </div>

      {/* After yes */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-emerald-800">When they say yes</p>
        <div className="space-y-1.5">
          <KeyPoint>Book a specific date and time before you hang up — don't let it be vague</KeyPoint>
          <KeyPoint>Ask: "What's the best entrance to use when I arrive?"</KeyPoint>
          <KeyPoint>Ask: "Is there anyone else from your team who should be there?"</KeyPoint>
          <KeyPoint>Send a calendar invite or confirmation text same day</KeyPoint>
          <KeyPoint>Log the visit in the CRM with the date</KeyPoint>
        </div>
      </div>

      {/* After no */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">When they say no / not now</p>
        <ScriptLine
          text={`"No problem at all — I appreciate you taking the call. Can I ask what would need to change for it to make sense? I'd rather know now than bother you at the wrong time."`}
          note="This gives you timing intelligence. If they say 'call me in Q3' or 'after our expansion,' that's a real follow-up date."
        />
        <div className="space-y-1.5 mt-2">
          <KeyPoint>Log the follow-up date they gave you</KeyPoint>
          <KeyPoint>Send a one-liner email the same day: "Good talking to you — I'll follow up in [timeframe] like you said."</KeyPoint>
          <KeyPoint>Mark in the CRM — not dead, just timing</KeyPoint>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScriptsPage() {
  const [tab, setTab] = useState<ScriptTab>("gatekeeper");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call Scripts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Reference these during calls — tap the objection to expand the response.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white p-1 gap-1">
        <button
          onClick={() => setTab("gatekeeper")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
            tab === "gatekeeper"
              ? "bg-gray-900 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Front desk / Security
        </button>
        <button
          onClick={() => setTab("decision_maker")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
            tab === "decision_maker"
              ? "bg-gray-900 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Maintenance manager / Buyer
        </button>
      </div>

      {/* Content */}
      {tab === "gatekeeper" ? <GatekeeperScript /> : <DecisionMakerScript />}
    </div>
  );
}
