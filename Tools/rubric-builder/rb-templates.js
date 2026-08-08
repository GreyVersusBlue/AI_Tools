/* Rubric Builder — starter template config.
   Each template is a plain data object: a label, an ordered list of
   performance levels ({label, points}), and an ordered list of criteria
   ({name, cells: [one description string per level, same order as levels]}).
   These are just editable starting points — the picker and renderer don't
   care how many levels or criteria a template has. */
(function (global) {
  'use strict';

  var TEMPLATES = [
    {
      key: 'four-point-standard',
      label: '4-Point Standard (Excellent / Good / Fair / Poor)',
      levels: [
        { label: 'Excellent', points: 4 },
        { label: 'Good', points: 3 },
        { label: 'Fair', points: 2 },
        { label: 'Poor', points: 1 }
      ],
      criteria: [
        {
          name: 'Content',
          cells: [
            'Thoroughly and clearly addresses the topic with strong, specific details and evidence.',
            'Addresses the topic with mostly relevant details and evidence.',
            'Partially addresses the topic; details are limited, vague, or off-topic.',
            'Does not address the topic or provides no relevant details.'
          ]
        },
        {
          name: 'Organization',
          cells: [
            'Ideas are logically sequenced with clear transitions and a strong introduction and conclusion.',
            'Ideas are generally organized with adequate transitions.',
            'Organization is inconsistent; transitions are weak or missing in places.',
            'Little to no organization; ideas are disconnected.'
          ]
        },
        {
          name: 'Mechanics (Grammar & Spelling)',
          cells: [
            'Virtually free of grammar, spelling, and punctuation errors.',
            'A few errors that do not interfere with meaning.',
            'Several errors that sometimes interfere with meaning.',
            'Frequent errors that make the writing difficult to understand.'
          ]
        }
      ]
    },
    {
      key: 'check-system',
      label: 'Check System (Check+ / Check / Check−)',
      levels: [
        { label: 'Check+', points: 2 },
        { label: 'Check', points: 1 },
        { label: 'Check−', points: 0 }
      ],
      criteria: [
        {
          name: 'Effort',
          cells: [
            'Went above and beyond what was asked.',
            'Met the basic expectations.',
            'Put in minimal effort.'
          ]
        },
        {
          name: 'Following Directions',
          cells: [
            'Followed all directions precisely.',
            'Followed most directions.',
            'Ignored or misunderstood most directions.'
          ]
        },
        {
          name: 'Preparedness',
          cells: [
            'Came fully prepared with all materials.',
            'Came prepared with most materials.',
            'Came unprepared.'
          ]
        }
      ]
    },
    {
      key: 'blank',
      label: 'Blank (default levels, no criteria)',
      levels: [
        { label: 'Excellent', points: 4 },
        { label: 'Good', points: 3 },
        { label: 'Fair', points: 2 },
        { label: 'Poor', points: 1 }
      ],
      criteria: []
    }
  ];

  function byKey(key) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].key === key) return TEMPLATES[i];
    return null;
  }

  global.RubricTemplates = { TEMPLATES: TEMPLATES, byKey: byKey };
})(typeof window !== 'undefined' ? window : global);
