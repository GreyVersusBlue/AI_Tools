/* Geography Bee / Map Skills Quiz Generator (062): the built-in questions, as
   data. Until v267 everything in this file sat in the page's inline script. It
   is here, word for word, comments and all, so that one copy serves two
   readers: the page itself, through items(), which hands back exactly what its
   script built before; and the site's question bank
   (_shared/question-bank.js), where the ninety text questions are a read-only
   seed set a teacher can play from or copy out of on 030 (Path 12 P2).
   Publishes window.GeographyBeeBank. A plain script; it needs nothing, and
   registers the set only on a page that loaded question-bank.js before it.

   THE MAPPING to a bank question, field by field (toQuestion):
     id        'bi12'        -> id 'seed:062:bi12' (QuestionBank.seedId)
     q                       -> prompt
     a                       -> answer
     category  'capitals'    -> unit 'Capitals' (the label a teacher sees and
                                filters by on 030), and the key itself kept
                                in `category`, a field the bank does not know
                                and carries
     area      'africa'      -> tags ['Africa'] (the label; none for
                                'global', which is no region), and the key
                                itself kept in `area`
     map       { dataset, region, context }
                             -> kept as `map`, as it is; but see below
     custom    false         -> nothing: every question in a seed set is a
                                built-in, which is what the flag said
   The bank's other fields have nothing to take from here and are blank:
   standard, difficulty, choices, media; points is 0 and there is no date. The
   page's multiple-choice options are drawn from the pool when a quiz is built
   and are not data, so no question has `choices`.

   WHAT IS NOT IN THE SET: the thirty map questions (bi90 to bi119). "Which
   country is highlighted on the map?" is not a question without the map, and
   only this tool can draw it (gbq-map.js). toQuestion() maps one all the same,
   with its `map` kept, and questions() leaves them out until a reader can show
   a picture (Path 12 P4). Also not in it: a teacher's own questions
   ('gbq_custom_v1'), and which built-ins they have switched off; a built-in
   switched off on 062 is still in the set. Stored nowhere: the set is built in
   memory each time this file loads. */
(function (global) {
  'use strict';

  var SET_ID = '062';
  var CAT_LABELS = { capitals: 'Capitals', landmarks: 'Landmarks', mapskills: 'Map Skills', maps: 'Map Questions' };

  /* Region tagging, added 2026-08-14. The four categories say what *kind* of
     question this is; the region says what part of the world it is about,
     which is the axis a teacher covering a unit actually plans along ("we
     are on South America this month"). The two are independent, so they
     filter independently and combine.

     Every built-in question carries its region as data — the fourth column
     of BUILTIN_RAW — rather than being classified at runtime from the words
     in it. gbq-map.js's own header explains why: an algorithm that decides
     where a place belongs is confidently wrong often enough (it puts Iraq in
     Africa and Russia in Europe) that shipping one for 90 questions would
     mean a teacher filtering to Africa gets Baghdad. The tagging was
     proposed from that module's continent lists and then read through
     one by one.

     'global' is a real answer, not a missing one: half the built-ins are map
     skills — latitude, scale, contour lines — that belong to no continent
     and should show up in every region's practice, which is what the filter
     does with them.

     Two transcontinental judgement calls, stated rather than buried: Russia
     and Turkey are filed under Europe, because a teacher filtering for a
     Europe unit expects Moscow and Ankara to appear. That is a *filter*
     decision and it does not touch gbq-map.js's crop data, where Russia is
     still drawn on a world map because its geometry wraps the antimeridian.

     Named `area` throughout the code, not `region`: this file already uses
     "region" for the state or country a map question highlights
     (`item.map.region`, and the `REGION_LABELS` lists further down), and two
     meanings of one word in one file is how the wrong one gets used. The UI
     still says "Region", which is what a teacher calls it. */
  var AREA_LABELS = {
    africa: 'Africa', asia: 'Asia', europe: 'Europe',
    'north-america': 'North America', 'south-america': 'South America',
    oceania: 'Oceania', global: 'No particular region'
  };
  var AREA_ORDER = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'oceania', 'global'];
  function isArea(r) { return AREA_ORDER.indexOf(r) !== -1; }

  var BUILTIN_RAW = [
    ['capitals', 'What is the capital of France?', 'Paris', 'europe'],
    ['capitals', 'What is the capital of Japan?', 'Tokyo', 'asia'],
    ['capitals', 'What is the capital of Australia?', 'Canberra', 'oceania'],
    ['capitals', 'What is the capital of Canada?', 'Ottawa', 'north-america'],
    ['capitals', 'What is the capital of Brazil?', 'Brasília', 'south-america'],
    ['capitals', 'What is the capital of Egypt?', 'Cairo', 'africa'],
    ['capitals', 'What is the capital of South Korea?', 'Seoul', 'asia'],
    ['capitals', 'What is the capital of Kenya?', 'Nairobi', 'africa'],
    ['capitals', 'What is the capital of Mexico?', 'Mexico City', 'north-america'],
    ['capitals', 'What is the capital of Russia?', 'Moscow', 'europe'],
    ['landmarks', 'In which country would you find the Great Pyramid of Giza?', 'Egypt', 'africa'],
    ['landmarks', 'In which country would you find the Eiffel Tower?', 'France', 'europe'],
    ['landmarks', 'In which country would you find Machu Picchu?', 'Peru', 'south-america'],
    ['landmarks', 'In which country would you find the Great Wall?', 'China', 'asia'],
    ['landmarks', 'In which country would you find the Taj Mahal?', 'India', 'asia'],
    ['landmarks', 'In which country would you find Mount Kilimanjaro?', 'Tanzania', 'africa'],
    ['landmarks', 'In which country would you find the Colosseum?', 'Italy', 'europe'],
    ['landmarks', 'In which country would you find Uluru (Ayers Rock)?', 'Australia', 'oceania'],
    ['landmarks', 'Which river is the longest in the world?', 'The Nile', 'africa'],
    ['landmarks', 'Which mountain range contains Mount Everest?', 'The Himalayas', 'asia'],
    ['mapskills', 'What is the imaginary line at 0° latitude called?', 'The Equator', 'global'],
    ['mapskills', 'What is the imaginary line at 0° longitude called?', 'The Prime Meridian', 'global'],
    ['mapskills', 'What tool on a map shows the meaning of its symbols?', 'The legend / key', 'global'],
    ['mapskills', 'What do you call a line on a map connecting points of equal elevation?', 'A contour line', 'global'],
    ['mapskills', 'What compass direction is directly opposite of North?', 'South', 'global'],
    ['mapskills', 'What is the term for the ratio between map distance and real distance?', 'Scale', 'global'],
    ['mapskills', 'What are the seven continents?', 'Africa, Antarctica, Asia, Australia, Europe, North America, South America', 'global'],
    ['mapskills', 'What do lines of latitude measure?', 'Distance north or south of the Equator', 'global'],
    ['mapskills', 'What do lines of longitude measure?', 'Distance east or west of the Prime Meridian', 'global'],
    ['mapskills', 'What symbol on a map typically points north?', 'A compass rose', 'global'],
    /* Grown from 10 to 30 per category (SS demo round, backlog rank 29) —
       new ids append here, bi30 onward; the original bi0-bi29 above are
       never renumbered since teachers' hidden-question lists reference
       them by id. World-balanced on purpose: the original 30 leaned
       Asia/Africa/Americas already, these add more of Europe, Southeast
       Asia, and the Middle East without tipping the set US/Europe-only. */
    ['capitals', 'What is the capital of Germany?', 'Berlin', 'europe'],
    ['capitals', 'What is the capital of Italy?', 'Rome', 'europe'],
    ['capitals', 'What is the capital of Spain?', 'Madrid', 'europe'],
    ['capitals', 'What is the capital of the United Kingdom?', 'London', 'europe'],
    ['capitals', 'What is the capital of India?', 'New Delhi', 'asia'],
    ['capitals', 'What is the capital of China?', 'Beijing', 'asia'],
    ['capitals', 'What is the capital of Indonesia?', 'Jakarta', 'asia'],
    ['capitals', 'What is the capital of Nigeria?', 'Abuja', 'africa'],
    ['capitals', 'What is the capital of Argentina?', 'Buenos Aires', 'south-america'],
    ['capitals', 'What is the capital of Chile?', 'Santiago', 'south-america'],
    ['capitals', 'What is the capital of Colombia?', 'Bogotá', 'south-america'],
    ['capitals', 'What is the capital of Turkey?', 'Ankara', 'europe'],
    ['capitals', 'What is the capital of Saudi Arabia?', 'Riyadh', 'asia'],
    ['capitals', 'What is the capital of Thailand?', 'Bangkok', 'asia'],
    ['capitals', 'What is the capital of Vietnam?', 'Hanoi', 'asia'],
    ['capitals', 'What is the capital of the Philippines?', 'Manila', 'asia'],
    ['capitals', 'What is the capital of New Zealand?', 'Wellington', 'oceania'],
    ['capitals', 'What is the capital of Sweden?', 'Stockholm', 'europe'],
    ['capitals', 'What is the capital of Poland?', 'Warsaw', 'europe'],
    ['capitals', 'What is the capital of Greece?', 'Athens', 'europe'],
    ['landmarks', 'In which country would you find the Statue of Liberty?', 'The United States', 'north-america'],
    ['landmarks', 'In which country would you find Christ the Redeemer?', 'Brazil', 'south-america'],
    ['landmarks', 'In which country would you find Petra, the ancient city carved into rock?', 'Jordan', 'asia'],
    ['landmarks', 'In which country would you find Angkor Wat?', 'Cambodia', 'asia'],
    ['landmarks', 'In which country would you find Stonehenge?', 'The United Kingdom', 'europe'],
    ['landmarks', 'In which country would you find Mount Fuji?', 'Japan', 'asia'],
    ['landmarks', 'In which country would you find the Great Barrier Reef?', 'Australia', 'oceania'],
    ['landmarks', 'What is the name of the tallest mountain peak in North America?', 'Denali', 'north-america'],
    ['landmarks', 'In which country would you find Salar de Uyuni, the world’s largest salt flat?', 'Bolivia', 'south-america'],
    ['landmarks', 'In which country would you find the Leaning Tower of Pisa?', 'Italy', 'europe'],
    ['landmarks', 'In which country would you find the Great Sphinx?', 'Egypt', 'africa'],
    ['landmarks', 'In which country would you find Ha Long Bay?', 'Vietnam', 'asia'],
    ['landmarks', 'In which country would you find Neuschwanstein Castle?', 'Germany', 'europe'],
    ['landmarks', 'Victoria Falls sits on the border of Zambia and which other country?', 'Zimbabwe', 'africa'],
    ['landmarks', 'Which desert is the largest hot desert in the world?', 'The Sahara', 'africa'],
    ['landmarks', 'The Amazon Rainforest is located mostly within which country?', 'Brazil', 'south-america'],
    ['landmarks', 'The Gobi Desert lies mainly in China and which other country?', 'Mongolia', 'asia'],
    ['landmarks', 'Iguazu Falls sits on the border of Brazil and which other country?', 'Argentina', 'south-america'],
    ['landmarks', 'Table Mountain is a famous landmark overlooking which South African city?', 'Cape Town', 'africa'],
    ['landmarks', 'The Amazon River empties into which ocean?', 'The Atlantic Ocean', 'south-america'],
    ['mapskills', 'What are the four cardinal directions?', 'North, South, East, and West', 'global'],
    ['mapskills', 'What are the four intermediate directions (halfway between the cardinal ones)?', 'Northeast, Northwest, Southeast, and Southwest', 'global'],
    ['mapskills', 'What is the term for a location described using exact latitude and longitude coordinates?', 'Absolute location', 'global'],
    ['mapskills', 'What is the term for a location described in relation to other places, like "next to the river"?', 'Relative location', 'global'],
    ['mapskills', 'What type of map shows natural features like mountains, rivers, and deserts?', 'A physical map', 'global'],
    ['mapskills', 'What type of map shows human-made boundaries like countries, states, and cities?', 'A political map', 'global'],
    ['mapskills', 'What type of map uses contour lines to show the shape and elevation of the land?', 'A topographic map', 'global'],
    ['mapskills', 'What is the term for the height of land above sea level?', 'Elevation', 'global'],
    ['mapskills', 'What is a small map inset into the corner of a larger map called?', 'An inset map', 'global'],
    ['mapskills', 'What is the imaginary line at 23.5° north of the Equator called?', 'The Tropic of Cancer', 'global'],
    ['mapskills', 'What is the imaginary line at 23.5° south of the Equator called?', 'The Tropic of Capricorn', 'global'],
    ['mapskills', 'What is the name of the line at 180° longitude, opposite the Prime Meridian?', 'The International Date Line', 'global'],
    ['mapskills', 'On a standard map, which cardinal direction is usually at the top?', 'North', 'global'],
    ['mapskills', 'What is the name for the system of latitude and longitude lines used to locate any place on Earth?', 'A grid system', 'global'],
    ['mapskills', 'What color usually represents the highest elevations on a relief or elevation map?', 'Brown', 'global'],
    ['mapskills', 'What type of map shows the average weather patterns of a region over time?', 'A climate map', 'global'],
    ['mapskills', 'What is the small bar on a map used to measure real-world distance called?', 'A scale bar', 'global'],
    ['mapskills', 'What is another name for lines of latitude?', 'Parallels', 'global'],
    ['mapskills', 'What is another name for lines of longitude?', 'Meridians', 'global'],
    ['mapskills', 'On most maps, what symbol marks a country’s capital city?', 'A star', 'global']
  ];

  /* ---------- built-in map questions (SS demo round 2) ----------
     A fourth question type: an outline map with one region picked out, drawn
     offline from the Blank Map Generator's own vendored Natural Earth data by
     ./geography-bee-quiz-generator/gbq-map.js.

     Each row is [dataset, name in the map data, what the student writes, crop].
     The name has to match the data exactly ("Dem. Rep. Congo"); the answer is
     what a 7th grader should actually put on the line. The crop is stated here
     rather than looked up so these 30 keep drawing even if the module can't
     load its region table.

     Ids continue the bi<N> scheme straight after bi89 and are NEVER
     renumbered — a teacher's hidden-question list points at them by id, so
     inserting a row above would silently hide the wrong question. Append only. */
  var MAP_BUILTINS = [
    ['us', 'Maryland', 'Maryland', 'usa-48'],
    ['us', 'Texas', 'Texas', 'usa-48'],
    ['us', 'California', 'California', 'usa-48'],
    ['us', 'Florida', 'Florida', 'usa-48'],
    ['us', 'New York', 'New York', 'usa-48'],
    ['us', 'Pennsylvania', 'Pennsylvania', 'usa-48'],
    ['us', 'Michigan', 'Michigan', 'usa-48'],
    ['us', 'Colorado', 'Colorado', 'usa-48'],
    ['us', 'Louisiana', 'Louisiana', 'usa-48'],
    ['us', 'Virginia', 'Virginia', 'usa-48'],
    ['us', 'Ohio', 'Ohio', 'usa-48'],
    ['us', 'Nevada', 'Nevada', 'usa-48'],
    ['us', 'Maine', 'Maine', 'usa-48'],
    ['us', 'Alaska', 'Alaska', 'usa-50'],
    ['us', 'Hawaii', 'Hawaii', 'usa-50'],
    ['world', 'France', 'France', 'europe'],
    ['world', 'Italy', 'Italy', 'europe'],
    ['world', 'Germany', 'Germany', 'europe'],
    ['world', 'Egypt', 'Egypt', 'africa'],
    ['world', 'Kenya', 'Kenya', 'africa'],
    ['world', 'South Africa', 'South Africa', 'africa'],
    ['world', 'Brazil', 'Brazil', 'south-america'],
    ['world', 'Argentina', 'Argentina', 'south-america'],
    ['world', 'Japan', 'Japan', 'asia'],
    ['world', 'India', 'India', 'asia'],
    ['world', 'China', 'China', 'asia'],
    ['world', 'Australia', 'Australia', 'oceania'],
    ['world', 'Mexico', 'Mexico', 'north-america'],
    ['world', 'Canada', 'Canada', 'north-america'],
    ['world', 'Russia', 'Russia', 'world']
  ];
  function mapQuestionText(dataset) {
    return dataset === 'us'
      ? 'Which US state is highlighted on the map?'
      : 'Which country is highlighted on the map?';
  }

  /* A map question's region comes from the crop it is already drawn on, which
     is why the notes called this half of the tagging free. The two special
     cases: every US state question is North America (its crop is usa-48 or
     usa-50, which are not continents), and the one country whose crop is
     'world' is Russia — filed under Europe here for the reason given above. */
  function mapAreaFor(row) {
    if (row[0] === 'us') return 'north-america';
    return isArea(row[3]) ? row[3] : 'europe';
  }

  var BUILTIN = BUILTIN_RAW.map(function (row, i) { return { id: 'bi' + i, category: row[0], q: row[1], a: row[2], area: row[3], custom: false }; })
    .concat(MAP_BUILTINS.map(function (row, i) {
      return {
        id: 'bi' + (BUILTIN_RAW.length + i), category: 'maps', custom: false,
        q: mapQuestionText(row[0]), a: row[2], area: mapAreaFor(row),
        map: { dataset: row[0], region: row[1], context: row[3] }
      };
    }));

  /** The built-ins as 062's page has always held them: bi0 to bi119, the
      thirty map questions last. A new list of new objects each call. */
  function items() {
    return BUILTIN.map(function (item) {
      var copy = {}, k;
      for (k in item) if (Object.prototype.hasOwnProperty.call(item, k)) copy[k] = item[k];
      if (item.map) copy.map = { dataset: item.map.dataset, region: item.map.region, context: item.map.context };
      return copy;
    });
  }

  /** One of items() as a question for the bank; the id is still the page's. */
  function toQuestion(item) {
    var q = {
      id: item.id, prompt: item.q, answer: item.a,
      unit: CAT_LABELS[item.category] || '',
      tags: item.area && item.area !== 'global' && AREA_LABELS[item.area] ? [AREA_LABELS[item.area]] : [],
      category: item.category, area: item.area
    };
    if (item.map) q.map = { dataset: item.map.dataset, region: item.map.region, context: item.map.context };
    return q;
  }

  /** The seed set: every built-in that is a question without a picture. */
  function questions() {
    return items().filter(function (item) { return !item.map; }).map(toQuestion);
  }

  global.GeographyBeeBank = {
    SET_ID: SET_ID, CAT_LABELS: CAT_LABELS, AREA_LABELS: AREA_LABELS, AREA_ORDER: AREA_ORDER,
    isArea: isArea, mapQuestionText: mapQuestionText,
    items: items, toQuestion: toQuestion, questions: questions
  };

  if (global.QuestionBank && global.QuestionBank.registerSet) {
    global.QuestionBank.registerSet({
      id: SET_ID, title: 'Geography Bee', source: '062 Geography Bee / Map Skills Quiz Generator',
      note: 'Capitals, landmarks and map skills. The map questions need 062 to draw the map and are not here.',
      questions: questions()
    });
  }
})(window);
