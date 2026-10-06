/* Cultural Trivia Card Generator (053): the built-in trivia, as data.
   Until v267 these thirty rows sat in the page's inline script. They are here,
   word for word, so that one copy serves two readers: the page itself, through
   items(), which hands back exactly what its script built before; and the
   site's question bank (_shared/question-bank.js), where they are a read-only
   seed set a teacher can play from or copy out of on 030 (Path 12 P2).
   Publishes window.CulturalTriviaBank. A plain script; it needs nothing, and
   registers the set only on a page that loaded question-bank.js before it.

   A row is [category, question, answer]. The page's id for a row is 'b' + its
   place in ROWS, and a teacher's hidden list ('ctcg_hidden_v1') holds those
   ids. So APPEND ONLY: a row put in above another, or taken out, would hide
   the wrong question for everyone who has hidden one, and would change the
   seed ids below.

   THE MAPPING to a bank question, field by field (toQuestion):
     id        'b3'          -> id 'seed:053:b3' (QuestionBank.seedId)
     q                       -> prompt
     a                       -> answer
     category  'hispanic'    -> unit 'Hispanic World' (the label a teacher
                                sees and filters by on 030), and the key
                                itself kept in `category`, a field the bank
                                does not know and carries
     custom    false         -> nothing: every question in a seed set is a
                                built-in, which is what the flag said
   The bank's other fields have nothing to take from here and are blank:
   standard, difficulty, tags, choices, media; points is 0 and there is no
   date. Stored nowhere: the set is built in memory each time this file loads.
   What is NOT in the set: a teacher's own questions ('ctcg_custom_v1') and
   which built-ins they have hidden; a hidden built-in is still in the set. */
(function (global) {
  'use strict';

  var SET_ID = '053';
  var CAT_LABELS = { hispanic: 'Hispanic World', francophone: 'Francophone World', global: 'Global Culture' };

  var ROWS = [
      ['hispanic', 'What is the traditional Mexican celebration honoring deceased loved ones called?', 'Día de los Muertos'],
      ['hispanic', 'What popular dance originated in Argentina?', 'Tango'],
      ['hispanic', 'What is the most widely spoken language in Spain besides Spanish, spoken in Barcelona?', 'Catalan'],
      ['hispanic', 'What ancient civilization built Machu Picchu?', 'The Inca'],
      ['hispanic', 'What is a popular Spanish tradition where people eat 12 grapes at midnight on New Year’s Eve?', 'Las doce uvas de la suerte'],
      ['hispanic', 'What is the name of the vibrant, multi-day festival held in Rio de Janeiro before Lent (in Brazil, Portuguese-speaking but culturally linked)?', 'Carnival (Carnaval)'],
      ['hispanic', 'What staple food, made from corn, is common across Latin America and used for tacos, arepas, or tamales?', 'Corn/maize (masa)'],
      ['hispanic', 'What is the name of Spain’s famous running-of-the-bulls festival city?', 'Pamplona'],
      ['hispanic', 'What Caribbean country is known as the birthplace of salsa music?', 'Cuba'],
      ['hispanic', 'What is the currency used in most of Spain and much of the EU?', 'The euro'],
      ['francophone', 'What French holiday celebrates the storming of the Bastille?', 'Bastille Day (July 14th)'],
      ['francophone', 'What famous art museum in Paris houses the Mona Lisa?', 'The Louvre'],
      ['francophone', 'What African country was formerly called the Ivory Coast in English?', 'Côte d’Ivoire'],
      ['francophone', 'What is the traditional French pastry shaped like a crescent?', 'Croissant'],
      ['francophone', 'What Canadian province is predominantly French-speaking?', 'Quebec'],
      ['francophone', 'What French-speaking Caribbean country shares an island with the Dominican Republic?', 'Haiti'],
      ['francophone', 'What is the name of the famous cycling race held annually in France?', 'The Tour de France'],
      ['francophone', 'What sweet, thin pancake is a popular French dessert?', 'Crêpe'],
      ['francophone', 'What is the name of France’s national motto?', 'Liberté, égalité, fraternité'],
      ['francophone', 'What African country has French and Kinyarwanda as official languages, known for its "thousand hills"?', 'Rwanda'],
      ['global', 'What is the largest continent by land area?', 'Asia'],
      ['global', 'What is the most widely spoken native language in the world?', 'Mandarin Chinese'],
      ['global', 'What festival of lights is celebrated by Hindus, Sikhs, and Jains?', 'Diwali'],
      ['global', 'What is the name of the Japanese art of paper folding?', 'Origami'],
      ['global', 'What South Korean pop music genre became a global phenomenon?', 'K-pop'],
      ['global', 'What is the name of the month-long fasting observance in Islam?', 'Ramadan'],
      ['global', 'What country is credited with inventing pizza in its modern form?', 'Italy'],
      ['global', 'What is the traditional Japanese tea ceremony called?', 'Chanoyu (or sadō)'],
      ['global', 'What African nation is home to the ancient pyramids of Giza?', 'Egypt'],
      ['global', 'What is the world’s most widely celebrated New Year based on the lunar calendar, especially in China?', 'Lunar New Year (Chinese New Year)']
  ];

  /** The built-ins as 053's page has always held them. A new list of new
      objects each call. */
  function items() {
    return ROWS.map(function (row, i) { return { category: row[0], q: row[1], a: row[2], custom: false, id: 'b' + i }; });
  }

  /** One of items() as a question for the bank; the id is still the page's. */
  function toQuestion(item) {
    return { id: item.id, prompt: item.q, answer: item.a, unit: CAT_LABELS[item.category] || '', category: item.category };
  }

  function questions() { return items().map(toQuestion); }

  global.CulturalTriviaBank = {
    SET_ID: SET_ID, CAT_LABELS: CAT_LABELS, ROWS: ROWS,
    items: items, toQuestion: toQuestion, questions: questions
  };

  if (global.QuestionBank && global.QuestionBank.registerSet) {
    global.QuestionBank.registerSet({
      id: SET_ID, title: 'Cultural Trivia', source: '053 Cultural Trivia Card Generator',
      note: 'Hispanic, Francophone and global culture.',
      questions: questions()
    });
  }
})(window);
