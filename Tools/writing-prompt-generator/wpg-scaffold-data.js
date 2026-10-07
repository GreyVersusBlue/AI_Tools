/* Writing Prompt Generator — sentence starters and "if you're stuck" lines.

   This file is only words, so a teacher (or whoever keeps this site) can change
   a line without touching any code. NOBODY HAS REVIEWED THESE LINES: they were
   written in one sitting and checked only by rules a test can state. Read them
   before a class does.

   How a line is found: wpg-scaffolds.js looks at the prompt's grade band
   ('ms' or 'hs'), its genre, and a task read off the prompt's own words
   (the 'tasks' below), then takes a few lines from that list, the same few
   every time for the same prompt.

   Rules a line has to keep (npm run test:writing-prompt-scaffolds checks them):
   - a starter ends with "..." so a student can see where to carry on, and holds
     no full sentence before that
   - a starter must make sense at the front of ANY prompt that list can be
     paired with. So a persuasive starter never takes a side ("I disagree"),
     a descriptive one never names an emotion (some prompts forbid it), and a
     narrative one never says what happened
   - an "if you're stuck" line is one concrete next step: a question to ask or a
     detail to picture. It is never a second prompt
   - keep every list at four lines or more: a sheet shows two to four */
(function (global) {
  'use strict';

  var STARTERS = {
    ms: {
      narrative: {
        any: [
          'It all started when...',
          'I still remember the moment...',
          'At first, I thought...',
          'The first thing I noticed was...',
          'Looking back now, I...',
          'Everything changed when...',
          'I will never forget how...',
          'The hardest part was...'
        ]
      },
      persuasive: {
        position: [
          'I think this because...',
          'My main reason is...',
          'Some people believe the opposite, but...',
          'One fact that supports my side is...',
          'The strongest example I can give is...',
          'Someone on the other side might say...',
          'The most important thing to think about is...',
          'This matters because...'
        ],
        audience: [
          'Here is the first thing I want you to think about...',
          'You might be wondering why...',
          'Imagine what it would be like if...',
          'I understand you may be worried that...',
          'My strongest reason is...',
          'Please think about this...',
          'Let me tell you why...'
        ]
      },
      descriptive: {
        any: [
          'The first thing I notice is...',
          'It looks, sounds, and feels like...',
          'What stands out most is...',
          'If I close my eyes, I can...',
          'Everything about it makes me think of...',
          'The best way I can show it is...',
          'A small detail most people miss is...',
          'It reminds me of...'
        ]
      },
      expository: {
        any: [
          'One important thing to know is...',
          'To understand this, it helps to know...',
          'A good example of this is...',
          'This matters because...',
          'The main idea is...',
          'One detail that explains it is...',
          'People often miss that...',
          'The simplest way to say it is...'
        ],
        steps: [
          'The first step is...',
          'Start by...',
          'The first thing to do is...',
          'The most important tip is...',
          'A common mistake to avoid is...',
          'To get started, think about...',
          'The key to doing this well is...'
        ]
      },
      creative: {
        any: [
          'Nobody noticed at first, but...',
          'The strangest part was...',
          'Everything changed when...',
          'It was the kind of day when...',
          'Without warning,...',
          'The first sign that something was wrong was...',
          'Then, out of nowhere...',
          'Just when things seemed normal...'
        ],
        opening: [
          'Before anyone could say another word...',
          'Nobody expected what happened next...',
          'Everything went quiet when...',
          'To understand how it got this far, you have to know...',
          'The next thing that happened was...',
          'The reason this was happening was...'
        ]
      }
    },
    hs: {
      narrative: {
        any: [
          'Looking back, the moment that mattered most was...',
          'I did not know it yet, but...',
          'What I remember most clearly is...',
          'It began with something small...',
          'At the time, I believed...',
          'The part I rarely say out loud is...',
          'Before that day, I had always...',
          'What I understand now is...'
        ]
      },
      persuasive: {
        position: [
          'The central issue is...',
          'The strongest evidence for my position is...',
          'Critics of my position would say...',
          'A real-world example of this is...',
          'This matters beyond the classroom because...',
          'The most important thing to weigh is...',
          'My position rests on...',
          'What this debate often overlooks is...',
          'If we look at the long-term effects...'
        ],
        audience: [
          'The first thing I ask you to consider is...',
          'You may be skeptical because...',
          'Consider what is at stake if...',
          'I understand the concern that...',
          'The strongest reason to act is...',
          'Think about who this affects...'
        ]
      },
      descriptive: {
        any: [
          'What strikes me first is...',
          'The detail I keep returning to is...',
          'If I had to pick one image, it would be...',
          'Underneath the obvious details...',
          'A sound, smell, or texture that stays with me is...',
          'Up close, it is...',
          'If I stay with it long enough, I notice...'
        ]
      },
      expository: {
        any: [
          'To understand this, it helps to start with...',
          'The central idea is...',
          'One key factor is...',
          'A clear example of this is...',
          'What makes this important is...',
          'This is often misunderstood because...',
          'At its core, this is about...',
          'One way to look at it is...'
        ],
        steps: [
          'The first step is...',
          'Before starting, it helps to know...',
          'The most important thing to get right is...',
          'A common mistake is...',
          'To begin with...',
          'The process starts with...'
        ]
      },
      creative: {
        any: [
          'By the time anyone noticed...',
          'The first sign that something was wrong was...',
          'It would have been easy to miss...',
          'What no one knew was...',
          'In the quiet before everything changed...',
          'Nothing about that morning suggested...',
          'The truth only came out when...',
          'Had anyone been watching...'
        ],
        opening: [
          'To understand how it got this far...',
          'Before anyone could speak again...',
          'What had led here was...',
          'The silence that followed...',
          'No one in the room knew that...',
          'Everything about this moment pointed to...'
        ]
      }
    }
  };

  var STUCK = {
    ms: {
      narrative: [
        'Picture the exact moment, then write down what you could see and hear.',
        'Ask yourself: what happened right before it, and who was there?',
        'Begin with the first thing someone said or thought, in quotation marks.',
        'Pick the one part you remember best and write only that part first.',
        'Ask yourself: how did I feel when it was over, and what made me feel that way?'
      ],
      persuasive: [
        'Jot down one reason for each side, then circle the one you can explain best.',
        'Ask yourself: who would be affected by this, and how?',
        'Think of a real time this came up for you and use it as your example.',
        'Ask yourself what the other side would say, and write down one answer to it.',
        'Say your opinion out loud in one sentence, then write that sentence down.'
      ],
      descriptive: [
        'Close your eyes and name one thing you can see, one you can hear, and one you can smell.',
        'Pick the smallest detail you can think of and describe only that.',
        'Ask yourself what you would notice first if you were seeing this for the first time.',
        'Think of something it looks or sounds like, and write that comparison.',
        'Jot down five words that belong to it, then use the best two in a sentence.'
      ],
      expository: [
        'Jot down the three most important things a beginner would need to know.',
        'Ask yourself what someone who knows nothing about this would ask first, then answer it.',
        'Think of one example you have seen or lived and use it to explain.',
        'List the main points on scrap paper, then number them in the order you will explain them.',
        'Say it out loud in your own words first, then write down what you said.'
      ],
      creative: [
        'Ask yourself: what does the main character want most, and what is in the way?',
        'Picture where the story happens and write down three things you can see there.',
        'Jot down the strangest thing that could happen next, then decide how a character would react.',
        'Decide who is in the story and what each one wants, then begin with the one who wants it most.',
        'Choose a first sentence that shows a character doing something, not just thinking.'
      ]
    },
    hs: {
      narrative: [
        'Picture the exact moment and write down one detail only you would remember.',
        'Ask yourself: what did I believe before this, and what did I believe after?',
        'Start with the line of dialogue or the thought that you can still hear.',
        'Pick the turning point first and write it alone, then add what came before and after.',
        'Ask yourself what you would tell your younger self about it, then write what led to that.'
      ],
      persuasive: [
        'Put your claim in one sentence, then list the two strongest reasons behind it.',
        'Ask yourself what the strongest objection to your claim is, then answer it.',
        'Find one concrete example, a number, a story, or a rule, that would convince a skeptic.',
        'Ask yourself who gains and who loses if you are right, and write down both.',
        'Say your position out loud in one sentence, then write that sentence down.'
      ],
      descriptive: [
        'Pick the one sense you have used least so far and write one detail for it.',
        'Choose a single object, sound, or gesture that stands for the whole and describe it closely.',
        'Ask yourself what is missing or out of place, and what that says about the whole.',
        'Jot down a comparison that surprises you, then test whether it holds.',
        'Look at it first from far away, then from as close as you can get.'
      ],
      expository: [
        'Put the one-sentence answer first, then list what a reader needs to follow it.',
        'Ask yourself what a reader who knows nothing about this would ask first, then answer it.',
        'Find one specific example, a date, a name, or a number, to anchor your explanation.',
        'List the causes or parts on scrap paper, then rank them by how much they matter.',
        'Ask yourself what is most often misunderstood about this, and start by correcting it.'
      ],
      creative: [
        'Ask yourself: what does the main character want most, and what stands in the way?',
        'Think of the most surprising thing a character could do next, then decide what it costs them.',
        'Picture the setting at one exact moment and write three details a reader could not guess.',
        'Choose the moment the story could not go back from, and write that scene first.',
        'Decide what your main character is hiding, then let one detail hint at it.'
      ]
    }
  };

  global.WpgScaffoldData = { STARTERS: STARTERS, STUCK: STUCK };
})(typeof window !== 'undefined' ? window : globalThis);
