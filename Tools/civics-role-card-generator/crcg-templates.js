/* crcg-templates.js — the built-in simulations for the Government/Civics
   Simulation Role Card Generator.

   Each template is a whole class period, not just a set of cards: roles (with
   realistic copy counts, positions, talking points and private case files),
   an agenda with time boxes and a teacher script cue per phase, a ballot or
   vote card matched to the simulation type, a scoring rubric, and an exit
   reflection. Loading a template fills all of it in, so the kit demos from
   the defaults with nothing typed.

   Which roles get a ballot slip is a flag on the role (`ballot: true`), so
   the slip count follows that role's copies count with nothing to keep in
   sync: 12 jurors get 12 verdict slips, 15 Council members get 15 vote cards.

   Everything here is written for 7th grade and kept politically neutral. The
   two civics simulations that touch real institutions (the UN Security
   Council, the Constitutional Convention) use the real structure and rules
   with a neutral question on the floor, and name roles by their job rather
   than by country or by historical figure, so no student is asked to argue a
   real nation's or real person's position.

   Text here is user-facing print copy: plain warm language, and no em dashes
   in anything added after 2026-08-14 (the older strings predate that rule and
   are left alone rather than churned, since the smoke suites read them).

   Exposed as window.CrcgTemplates: { key: { label, title, roles, agenda,
   ballot, rubric, reflection } }. The tool's <select> is built from `label`. */
(function () {
  'use strict';

  /* Shared fact pattern for the Mock Trial template's case-file text: Judge,
     Prosecution, and Defense all get the same background (real mock trials
     hand every side the same discovery packet); the Witness gets a separate,
     personal statement instead. Jurors get none — they decide from what's
     presented in the room, not outside facts. */
  var MOCK_TRIAL_CASE = 'Case: In re Search of Locker #214, Roosevelt Middle School. On a Tuesday morning, an assistant principal received an anonymous tip that a student, Casey Bennett, was keeping a vape pen in locker #214. Without asking Casey first, the assistant principal opened the locker with the master key and found a vape pen wrapped in a jacket. School policy says lockers are school property and can be searched when there is reasonable suspicion. Casey says the tip was unreliable and the search violated their privacy.';

  var DEFAULT_LEVELS = ['4 Strong', '3 Solid', '2 Developing', '1 Beginning'];

  /* The three reflection prompts every template ships. They are the same
     questions in every simulation on purpose: students answer the same three
     across a year of simulations, so the answers get better. */
  function reflectionPrompts() {
    return [
      'What role did you play, and what was your job in the room?',
      'What was the strongest argument you heard from someone else? What made it strong?',
      'If we ran this again tomorrow, what would you argue differently?'
    ];
  }

  var TEMPLATES = {
    mock_trial: {
      label: 'Mock Trial',
      title: 'Mock Trial: The Search of Locker #214',
      roles: [
        { role: 'Judge', position: 'Neutral — oversees the trial and ensures rules are followed', copies: 1, points: ['Introduce the case and both sides', 'Rule on objections', 'Instruct the jury before deliberation'], caseFile: MOCK_TRIAL_CASE },
        { role: 'Prosecution / Plaintiff Attorney', position: 'Arguing the defendant is responsible', copies: 2, points: ['Present opening statement', 'Call and question witnesses', 'Deliver closing argument summarizing the evidence'], caseFile: MOCK_TRIAL_CASE },
        { role: 'Defense Attorney', position: 'Arguing the defendant is not responsible', copies: 2, points: ['Present opening statement', 'Cross-examine opposing witnesses', 'Deliver closing argument creating reasonable doubt'], caseFile: MOCK_TRIAL_CASE },
        { role: 'Witness', position: 'Provides testimony for one side', copies: 4, points: ['Answer questions truthfully based on your assigned facts', 'Stay in character during cross-examination'], caseFile: 'You are the hall monitor who was standing near locker #214 that morning. You saw the assistant principal open the locker while Casey was still in first period, not present. You did not see or read the anonymous tip yourself. Under cross-examination, be honest that you don\'t know who sent the tip or whether it was reliable.' },
        { role: 'Juror', position: 'Neutral — decides the verdict', copies: 12, points: ['Listen carefully to all evidence', 'Discuss respectfully during deliberation', 'Reach a verdict based on the evidence presented'], caseFile: '', ballot: true }
      ],
      agenda: [
        { name: 'Set up the courtroom', minutes: 5, cue: 'Jury along one wall, attorney tables at the front, witnesses waiting outside the door.' },
        { name: 'Opening statements', minutes: 10, cue: 'Three minutes a side. Remind them an opening tells the story and saves the arguing for later.' },
        { name: 'Witness questioning', minutes: 15, cue: 'Prosecution calls first. Every witness gets a full cross before the next one is called.' },
        { name: 'Closing arguments', minutes: 8, cue: 'Three minutes a side. Ask each one to name the single fact that decides the case.' },
        { name: 'Jury deliberation', minutes: 10, cue: 'Jurors move to the back table. Everyone speaks once before anyone speaks twice.' },
        { name: 'Verdict and debrief', minutes: 7, cue: 'Read the verdict, then ask the room which piece of evidence actually moved them.' }
      ],
      ballot: {
        title: 'Juror Verdict Slip',
        question: 'Was the search of locker #214 allowed under the school policy?',
        instructions: 'Circle one, then write the one piece of evidence that decided it for you. Do not sign your name.',
        options: ['The search was allowed', 'The search was not allowed'],
        names: false
      },
      rubric: [
        { name: 'Prepared evidence', top: 'Points to a specific fact from the case file instead of a general opinion.' },
        { name: 'Responds to the other side', top: 'Answers the argument that was actually made, not an easier one.' },
        { name: 'Follows courtroom procedure', top: 'Waits to be recognized, objects properly, and stays in role the whole time.' },
        { name: 'Civil tone', top: 'Disagrees with the argument and never with the person making it.' }
      ]
    },

    debate: {
      label: 'Debate',
      title: 'Debate: Should students use cell phones at lunch?',
      roles: [
        { role: 'Affirmative Team', position: 'Arguing in favor of the resolution', copies: 3, points: ['Present a clear opening argument', 'Provide evidence supporting your position', 'Rebut the opposing team\'s points'], caseFile: 'Resolution: Students should be allowed to use cell phones during lunch. Your case: lunch is unstructured personal time, not instructional time. Allowing phones lets students contact family, listen to music, or use a translation app. Most students already carry phones in their backpacks, so supervised use during lunch only is a small, practical change.' },
        { role: 'Negative Team', position: 'Arguing against the resolution', copies: 3, points: ['Present a clear opening argument', 'Provide evidence against the resolution', 'Rebut the affirmative team\'s points'], caseFile: 'Resolution: Students should be allowed to use cell phones during lunch. Your case: lunch is one of the few times students talk face-to-face, and phones make that harder. Phones at lunch also make it easier to record other students without permission, or to see a hurtful message that followed someone from home. Keeping lunch phone-free protects that social time and cuts down on conflict.' },
        { role: 'Moderator', position: 'Neutral — keeps the debate on track', copies: 1, points: ['Introduce the resolution and both teams', 'Enforce time limits', 'Facilitate the audience Q&A if used'], caseFile: 'Your job is to keep the debate fair and on schedule, not to argue either side. Introduce the resolution and both teams, enforce the time limit for each speech, and remind teams to address the resolution instead of each other personally.' },
        { role: 'Judge / Scorer', position: 'Neutral — evaluates the debate', copies: 3, points: ['Score each team on evidence and delivery', 'Decide which team argued more persuasively'], caseFile: 'Score each team on three things: how clearly they explained their argument, how well they backed it up with evidence or real examples, and how directly they answered the other side\'s points. Give each category a score out of 5, then add them up. Don\'t score based on which side you personally agree with — score the reasoning and delivery.', ballot: true }
      ],
      agenda: [
        { name: 'Teams take their tables', minutes: 4, cue: 'Affirmative on the left, negative on the right, judges in the back with their slips.' },
        { name: 'Opening arguments', minutes: 10, cue: 'Four minutes a side, affirmative first. Judges score, they do not react.' },
        { name: 'Cross questions', minutes: 10, cue: 'Two minutes each way. Questions only, no speeches disguised as questions.' },
        { name: 'Rebuttals', minutes: 8, cue: 'Three minutes a side, negative first this time. New evidence is not allowed here.' },
        { name: 'Judges score and confer', minutes: 5, cue: 'Judges fill in their slips silently before they say a word to each other.' },
        { name: 'Decision and debrief', minutes: 8, cue: 'Judges announce and explain. Close by asking who changed their mind and why.' }
      ],
      ballot: {
        title: 'Judge Scoring Slip',
        question: 'Which side argued the resolution more persuasively?',
        instructions: 'Circle one, then write the one argument that decided it. Score the reasoning, not the side you agree with.',
        options: ['Affirmative', 'Negative'],
        names: true
      },
      rubric: [
        { name: 'Clear argument', top: 'States the claim in one sentence a listener could repeat back.' },
        { name: 'Prepared evidence', top: 'Backs the claim with a specific example, number, or source, not just an opinion.' },
        { name: 'Responds to the other side', top: 'Names the other team\'s actual argument and answers it directly.' },
        { name: 'Delivery and timing', top: 'Speaks up, looks at the room, and finishes inside the time limit.' },
        { name: 'Civil tone', top: 'Disagrees with the argument and never with the person making it.' }
      ]
    },

    legislative: {
      label: 'Legislative Simulation',
      title: 'Committee Session: Bill 24, the School Recess Extension Act',
      roles: [
        { role: 'Bill Sponsor', position: 'Supports passing the bill', copies: 1, points: ['Explain what the bill does and why it\'s needed', 'Answer questions from other members', 'Rally support for a yes vote'], caseFile: 'Bill 24, the School Recess Extension Act, would add 15 minutes of recess to the middle school day, taken from the daily advisory period. Research shows a longer break improves focus and cuts down on afternoon discipline referrals. Be ready to explain why the extra 15 minutes of recess matters more than that same time in advisory.', ballot: true },
        { role: 'Committee Chair', position: 'Neutral — runs the session', copies: 1, points: ['Recognize speakers in order', 'Keep discussion on topic and on time', 'Call for and record the final vote'], caseFile: 'Your job is neutral: you run the meeting, you don\'t argue for or against Bill 24. Recognize speakers in the order they raise their hand, and keep each turn to about a minute. Before debate starts, read the bill\'s one-sentence summary aloud: it adds 15 minutes of recess by shortening advisory.' },
        { role: 'Opposing Legislator', position: 'Opposes the bill as written', copies: 6, points: ['Raise specific concerns or objections', 'Propose an amendment if appropriate', 'Explain your reasoning for a no vote'], caseFile: 'Bill 24 would cut advisory time to add recess. Your case: advisory is used for makeup work, silent reading, and check-ins with a trusted adult, and losing 15 minutes of it hurts the students who need that support most. Propose an alternative, such as taking the extra recess time from lunch instead.', ballot: true },
        { role: 'Supporting Legislator', position: 'Supports the bill', copies: 6, points: ['Add supporting arguments beyond the sponsor\'s', 'Respond to the opposition\'s concerns'], caseFile: 'Bill 24 would add 15 minutes of recess by shortening advisory. Your case: students report advisory already runs short on structured activities most days, and unstructured recess time is proven to help kids focus for the rest of the school day. Back up the sponsor\'s argument with a reason of your own.', ballot: true }
      ],
      agenda: [
        { name: 'Chair calls the session to order', minutes: 3, cue: 'Chair reads the one-sentence summary of Bill 24 aloud before anyone speaks.' },
        { name: 'Sponsor presents the bill', minutes: 5, cue: 'Uninterrupted. Members write down questions instead of asking them yet.' },
        { name: 'Questions to the sponsor', minutes: 8, cue: 'Questions only. Chair keeps a speakers list so the same three voices do not take it over.' },
        { name: 'Open debate', minutes: 12, cue: 'One minute each, alternating for and against. Chair cuts off anyone who repeats a point already made.' },
        { name: 'Amendments', minutes: 8, cue: 'A member moves an amendment, someone seconds it, then a quick show of hands.' },
        { name: 'Roll-call vote and debrief', minutes: 9, cue: 'Collect the vote cards, count out loud, then ask who voted differently than they expected to.' }
      ],
      ballot: {
        title: 'Roll-Call Vote Card',
        question: 'On the passage of Bill 24, the School Recess Extension Act, as amended:',
        instructions: 'Circle your vote and write one sentence of reasoning. A roll-call vote is public, so put your name on it.',
        options: ['Yea', 'Nay', 'Present (abstain)'],
        names: true
      },
      rubric: [
        { name: 'Knows the bill', top: 'Can say what Bill 24 actually changes without reading the card word for word.' },
        { name: 'Prepared evidence', top: 'Brings a reason from the case file or from school life, not just a preference.' },
        { name: 'Responds to other members', top: 'Refers to something another member said and builds on it or answers it.' },
        { name: 'Follows the rules of debate', top: 'Waits to be recognized, keeps to the time, and speaks to the chair.' },
        { name: 'Civil tone', top: 'Disagrees with the argument and never with the person making it.' }
      ]
    },

    un_security_council: {
      label: 'UN Security Council Resolution Debate',
      title: 'UN Security Council: Draft Resolution on Earthquake Relief for Marovia',
      roles: [
        { role: 'Council President', position: 'Neutral. Chairs the session and calls the vote.', copies: 1, points: ['Open the session and read the draft resolution aloud', 'Keep the speakers list and hold each delegate to two minutes', 'Call the roll-call vote and announce the result'], caseFile: 'You chair this session. The presidency of the Council rotates every month, so today it is your job to run the room, not to argue. Read Draft Resolution 2026-1 aloud at the start: it would open a relief corridor into the Kesh Valley and send a 90-day monitoring team. Keep a speakers list, hold everyone to two minutes, and call the roll at the end. If a permanent member votes no, say plainly what that means: the resolution fails even with nine yes votes.' },
        { role: 'Permanent Member Delegate', position: 'Represents a permanent member. Holds a veto.', copies: 5, points: ['State whether your delegation supports the relief corridor', 'Explain what would have to change for you to vote yes', 'Use the veto only if you can explain the reason out loud'], caseFile: 'You represent one of the five permanent members of the Council. Your vote counts once, like everyone else\'s, but a no vote from you blocks the resolution no matter how many others vote yes. That power is the whole reason this seat exists, and it is also why other delegates will ask you to justify using it. Two real questions are on the table: aid needs to move fast, and a foreign monitoring team inside another country\'s borders is a serious step that country has to agree to. Decide which of those weighs more for your delegation, say so plainly, and name the one change that would move your vote.', ballot: true },
        { role: 'Elected Member Delegate', position: 'Represents a two-year elected member. One vote, no veto.', copies: 10, points: ['Ask the relief coordinator one question about what is actually needed', 'Say what your delegation needs added to the text to vote yes', 'Propose an amendment if the draft goes too far or not far enough'], caseFile: 'You hold one of the ten elected seats, which rotate every two years. You have one vote and no veto, so your influence comes from what you can get written into the text before the vote. Nine yes votes are needed for the resolution to pass. Read the draft with one question in mind: does it get food and clean water into the Kesh Valley quickly, and does it respect Marovia\'s right to decide what happens inside its own borders? Bring one specific change you want, such as a shorter monitoring period or a report back to the Council in 30 days.', ballot: true },
        { role: 'Delegate of the Affected State', position: 'Speaks for Marovia. Invited to address the session, no vote.', copies: 1, points: ['Describe what your country needs most in the first week', 'Say clearly what your government will and will not agree to', 'Respond to any amendment that changes what happens on your territory'], caseFile: 'You speak for the Republic of Marovia, where the earthquake hit. Council rules let a country under discussion address the session even though it is not a member, so you may speak but you do not vote. Your position: your people need the aid badly, and the roads into the Kesh Valley run through a region your government does not fully control. You want the relief corridor, and you want the monitoring team kept short and clearly limited, because a foreign team inside your borders is a hard thing to explain at home. Be specific about what your government can accept.' },
        { role: 'UN Relief Coordinator (briefer)', position: 'Neutral expert. Reports what aid workers on the ground need.', copies: 1, points: ['Give a two-minute briefing on conditions before debate starts', 'Answer factual questions without taking a side', 'Say honestly when the answer is that nobody knows yet'], caseFile: 'You are the neutral briefer. You do not argue for or against the resolution, and you do not vote. Your job is to tell the Council what is true right now: about 40,000 people in the Kesh Valley are cut off, the two main roads are blocked by landslides, and helicopters can reach only one of the four affected towns. Supplies are staged at the border and could move within 48 hours if the corridor opens. If a delegate asks something you do not know, say you do not know. That answer is worth more to the room than a guess.' },
        { role: 'Council Recorder', position: 'Neutral. Keeps the speakers list and records the vote.', copies: 1, points: ['Write down the order delegates ask to speak', 'Record every amendment as it is proposed', 'Read back the final tally of yes, no, and abstain'], caseFile: 'You keep the record. Write down the order delegates ask to speak and hand the list to the President. Note every amendment word for word as it is proposed, because the room will argue later about what it actually said. At the vote, collect the cards, count yes, no, and abstain out loud, and check whether any permanent member voted no before you announce the result.' }
      ],
      agenda: [
        { name: 'President opens the session', minutes: 4, cue: 'President reads Draft Resolution 2026-1 aloud. Nobody debates yet.' },
        { name: 'Briefing from the relief coordinator', minutes: 5, cue: 'Two-minute briefing, then factual questions only. Cut off anything that sounds like a speech.' },
        { name: 'Statement from Marovia', minutes: 4, cue: 'The affected state speaks before the members do, and does not vote.' },
        { name: 'Delegate statements', minutes: 14, cue: 'Two minutes each, in the order on the speakers list. Delegates say what would change their vote.' },
        { name: 'Amendments and negotiation', minutes: 10, cue: 'Let delegations talk across the table. Recorder writes each amendment down as proposed.' },
        { name: 'Roll-call vote and debrief', minutes: 8, cue: 'Nine yes votes to pass, and no veto. Ask afterward whether the veto helped or hurt the people in the valley.' }
      ],
      ballot: {
        title: 'Security Council Vote Card',
        question: 'On the adoption of Draft Resolution 2026-1, opening a relief corridor into the Kesh Valley:',
        instructions: 'Circle your vote and write one sentence of reasoning. Council votes are public, so sign your delegation. Nine yes votes are needed to pass, and a no from any permanent member blocks it.',
        options: ['Yes', 'No', 'Abstain'],
        names: true
      },
      rubric: [
        { name: 'Knows the draft resolution', top: 'Can say what the text actually authorizes without rereading the whole card.' },
        { name: 'Represents the seat, not the self', top: 'Argues the delegation\'s position even when it differs from their own opinion.' },
        { name: 'Prepared evidence', top: 'Uses a fact from the briefing or the case file to support the position.' },
        { name: 'Negotiates toward a vote', top: 'Names a specific change that would move their vote instead of just objecting.' },
        { name: 'Civil tone', top: 'Disagrees with the argument and never with the person making it.' }
      ]
    },

    constitutional_convention: {
      label: 'Constitutional Convention Compromise Session',
      title: 'Constitutional Convention, 1787: How Should States Be Represented?',
      roles: [
        { role: 'Presiding Officer', position: 'Neutral. Runs the session and does not debate.', copies: 1, points: ['Read the question on the floor before debate begins', 'Recognize delegates and hold each to one minute', 'Call the vote on the compromise plan and announce the count'], caseFile: 'You preside over the Convention. The presiding officer at the real Convention almost never spoke in debate, and neither do you today. Read the question on the floor at the start: should states be represented in Congress by population, or should every state have an equal voice? Recognize delegates in order, hold each to a minute, and stop anyone who repeats a point the room has already heard. Call the vote at the end and announce the count without commenting on it.' },
        { role: 'Large-State Delegate', position: 'Supports representation based on population.', copies: 7, points: ['Argue that a state with more people should have more votes', 'Use a number: compare two states\' populations out loud', 'Say what you could accept if the small states will not budge'], caseFile: 'You come from one of the larger states. Your case: a government that represents people should count people. In 1787 Virginia had roughly twelve times the free population of Delaware, and under the old Articles of Confederation each of them had exactly one vote in Congress. That meant a delegate from a small state spoke for far fewer people than you do, and could still cancel out your vote. You want representation in Congress based on population. Come ready with one comparison of two states to make the point concrete, and know in advance what you could live with if neither side gives way.', ballot: true },
        { role: 'Small-State Delegate', position: 'Supports an equal vote for every state.', copies: 7, points: ['Argue that every state is an equal partner in the union', 'Explain what happens to your state under population-only rules', 'Say what you could accept if the large states will not budge'], caseFile: 'You come from one of the smaller states. Your case: the states are entering this union as equals, and a state that gives up its independence should not be outvoted every time by three or four large neighbors. Under a population-only Congress, the largest states could pass anything they wanted without a single small-state vote. You want every state to have an equal voice. Come ready to say plainly what your state loses under population-only rules, and know in advance what you could live with if neither side gives way.', ballot: true },
        { role: 'Compromise Committee Member', position: 'Sent to find a plan both sides can accept.', copies: 8, points: ['Listen for what each side says it cannot give up', 'Draft a plan that gives each side its one non-negotiable', 'Present the plan to the floor in under two minutes'], caseFile: 'You sit on the committee the Convention sent out to break the deadlock. Your job is not to win for one side. Listen to both sides for the one thing each says it cannot give up, then build a plan around those two things. The historical answer, worked out by a committee much like yours, was a two-house Congress: one house with seats based on population, and one house where every state gets the same number of seats. You do not have to land on that answer, but you do have to bring a plan to the floor that gives both sides something real, and you have to be able to explain in one sentence why each side should accept it.', ballot: true },
        { role: 'Convention Secretary', position: 'Neutral. Records motions and the final vote.', copies: 1, points: ['Write down each plan exactly as it is proposed', 'Read a motion back when delegates disagree about its wording', 'Count and report the final vote'], caseFile: 'You keep the Convention\'s record. Write down each plan exactly as it is proposed, because the room will argue later about what it actually said, and you are the only one who will know. When two delegates disagree about the wording of a motion, read it back. At the end, collect the vote cards, count them, and report the total without adding your own opinion.' }
      ],
      agenda: [
        { name: 'Presiding officer states the question', minutes: 3, cue: 'Read the question on the floor. Population, or an equal vote per state?' },
        { name: 'Large-state delegates speak', minutes: 8, cue: 'One minute each. Push them to use an actual population comparison.' },
        { name: 'Small-state delegates speak', minutes: 8, cue: 'One minute each. Push them to say what their state loses, specifically.' },
        { name: 'Committee withdraws to draft a plan', minutes: 10, cue: 'Committee steps to the side table. Everyone else writes their one non-negotiable on a slip.' },
        { name: 'Committee presents the compromise', minutes: 6, cue: 'Two minutes to present, then questions from the floor. No speeches disguised as questions.' },
        { name: 'Vote and debrief', minutes: 10, cue: 'Collect the cards and count out loud. Then show them what the real Convention agreed to and compare.' }
      ],
      ballot: {
        title: 'Convention Vote Card',
        question: 'On the adoption of the compromise plan presented by the committee:',
        instructions: 'Circle your vote and write one sentence of reasoning. At the real Convention each state cast one vote. Here every delegate votes, so the room can see how close it was.',
        options: ['Aye', 'Nay', 'Abstain'],
        names: true
      },
      rubric: [
        { name: 'Knows the question on the floor', top: 'Can state the disagreement in one sentence without reading the card.' },
        { name: 'Represents the state, not the self', top: 'Argues the assigned position even when it differs from their own opinion.' },
        { name: 'Prepared evidence', top: 'Uses a specific comparison or fact from the case file, not just a preference.' },
        { name: 'Works toward a compromise', top: 'Names something they could give up, not only what they must have.' },
        { name: 'Civil tone', top: 'Disagrees with the argument and never with the person making it.' }
      ]
    },

    blank: {
      label: 'Blank / Custom',
      title: 'My Simulation',
      roles: [
        { role: 'New Role', position: '', copies: 1, points: [''], caseFile: '', ballot: true }
      ],
      /* The blank template is an explicit choice, not a migration, so it ships
         a plain generic kit to build on rather than four empty sections. */
      agenda: [
        { name: 'Set up and explain roles', minutes: 5, cue: 'Hand out cards and case files. Give everyone a minute to read their own.' },
        { name: 'Opening statements', minutes: 10, cue: 'Each side or group speaks once, uninterrupted.' },
        { name: 'Open discussion', minutes: 15, cue: 'Keep a speakers list so the same few voices do not take it over.' },
        { name: 'Vote and debrief', minutes: 10, cue: 'Collect the slips, count out loud, then ask what changed anyone\'s mind.' }
      ],
      ballot: {
        title: 'Vote Slip',
        question: 'Write the question being voted on here.',
        instructions: 'Circle one and write one sentence of reasoning.',
        options: ['Yes', 'No', 'Abstain'],
        names: false
      },
      rubric: [
        { name: 'Prepared evidence', top: 'Supports the point with a specific fact instead of a general opinion.' },
        { name: 'Responds to the other side', top: 'Answers the argument that was actually made.' },
        { name: 'Stays in role', top: 'Argues the assigned position for the whole activity.' },
        { name: 'Civil tone', top: 'Disagrees with the argument and never with the person making it.' }
      ]
    }
  };

  /** A template expanded into a fresh v2 document, ids and all. `uid` comes
      from the store so both halves hand out the same kind of id. */
  function build(key, uid) {
    var t = TEMPLATES[key] || TEMPLATES.blank;
    return {
      v: 2,
      title: t.title,
      roles: t.roles.map(function (r) {
        return {
          id: uid(), role: r.role, position: r.position, copies: r.copies || 1,
          students: [], caseFile: r.caseFile || '', ballot: !!r.ballot,
          points: r.points.map(function (text) { return { id: uid(), text: text }; })
        };
      }),
      agenda: t.agenda.map(function (p) {
        return { id: uid(), name: p.name, minutes: p.minutes, cue: p.cue };
      }),
      ballot: {
        title: t.ballot.title, question: t.ballot.question,
        instructions: t.ballot.instructions, options: t.ballot.options.slice(),
        names: !!t.ballot.names, extra: 0
      },
      rubric: {
        levels: DEFAULT_LEVELS.slice(),
        criteria: t.rubric.map(function (c) { return { id: uid(), name: c.name, top: c.top }; })
      },
      reflection: {
        title: 'Simulation Reflection',
        prompts: reflectionPrompts().map(function (text) { return { id: uid(), text: text }; })
      },
      print: { agenda: true, cards: true, caseFiles: true, ballots: true, rubric: true, reflections: true }
    };
  }

  function options() {
    return Object.keys(TEMPLATES).map(function (k) { return { key: k, label: TEMPLATES[k].label }; });
  }

  window.CrcgTemplates = { build: build, options: options, DEFAULT_LEVELS: DEFAULT_LEVELS };
})();
