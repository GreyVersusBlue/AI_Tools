/* Formula Reference Sheet Builder — template config.
   Each template is a plain data object: a label plus a list of
   {name, expression, note} formula entries. Adding a new topic later is
   just adding an entry to TEMPLATES — the picker and renderer don't change. */
(function (global) {
  'use strict';

  var TEMPLATES = [
    {
      key: 'geometry-area-perimeter',
      label: 'Geometry — Area & Perimeter',
      items: [
        { name: 'Rectangle — Area', expression: 'A = l × w', note: 'length × width' },
        { name: 'Rectangle — Perimeter', expression: 'P = 2l + 2w', note: '' },
        { name: 'Square — Area', expression: 'A = s²', note: 's = side length' },
        { name: 'Square — Perimeter', expression: 'P = 4s', note: '' },
        { name: 'Triangle — Area', expression: 'A = ½ b h', note: 'b = base, h = height' },
        { name: 'Triangle — Perimeter', expression: 'P = a + b + c', note: 'sum of all three sides' },
        { name: 'Parallelogram — Area', expression: 'A = b h', note: '' },
        { name: 'Trapezoid — Area', expression: 'A = ½ (b₁ + b₂) h', note: 'b₁, b₂ = parallel sides' },
        { name: 'Circle — Area', expression: 'A = π r²', note: '' },
        { name: 'Circle — Circumference', expression: 'C = 2π r', note: '' }
      ]
    },
    {
      key: 'geometry-volume-surface-area',
      label: 'Geometry — Volume & Surface Area',
      items: [
        { name: 'Cube — Volume', expression: 'V = s³', note: '' },
        { name: 'Cube — Surface Area', expression: 'SA = 6s²', note: '' },
        { name: 'Rectangular Prism — Volume', expression: 'V = l × w × h', note: '' },
        { name: 'Rectangular Prism — Surface Area', expression: 'SA = 2(lw + lh + wh)', note: '' },
        { name: 'Cylinder — Volume', expression: 'V = π r² h', note: '' },
        { name: 'Cylinder — Surface Area', expression: 'SA = 2π r² + 2π r h', note: '' },
        { name: 'Sphere — Volume', expression: 'V = 4⁄3 π r³', note: '' },
        { name: 'Sphere — Surface Area', expression: 'SA = 4π r²', note: '' },
        { name: 'Cone — Volume', expression: 'V = 1⁄3 π r² h', note: '' }
      ]
    },
    {
      key: 'algebra-linear',
      label: 'Algebra — Linear Equations',
      items: [
        { name: 'Slope', expression: 'm = (y₂ − y₁) / (x₂ − x₁)', note: 'rise over run' },
        { name: 'Slope-Intercept Form', expression: 'y = mx + b', note: 'b = y-intercept' },
        { name: 'Point-Slope Form', expression: 'y − y₁ = m(x − x₁)', note: '' },
        { name: 'Standard Form', expression: 'Ax + By = C', note: '' },
        { name: 'Distance Formula', expression: 'd = √[(x₂−x₁)² + (y₂−y₁)²]', note: '' },
        { name: 'Midpoint Formula', expression: 'M = ((x₁+x₂)/2, (y₁+y₂)/2)', note: '' }
      ]
    },
    {
      key: 'algebra-quadratics',
      label: 'Algebra — Quadratics',
      items: [
        { name: 'Standard Form', expression: 'y = ax² + bx + c', note: '' },
        { name: 'Quadratic Formula', expression: 'x = [−b ± √(b² − 4ac)] / 2a', note: '' },
        { name: 'Discriminant', expression: 'Δ = b² − 4ac', note: '> 0 two roots, = 0 one root, < 0 none real' },
        { name: 'Vertex Form', expression: 'y = a(x − h)² + k', note: '(h, k) = vertex' },
        { name: 'Axis of Symmetry', expression: 'x = −b / 2a', note: '' }
      ]
    },
    {
      key: 'basic-statistics',
      label: 'Basic Statistics',
      items: [
        { name: 'Mean', expression: 'x̄ = (Σx) / n', note: 'sum of values ÷ count' },
        { name: 'Median', expression: 'middle value', note: 'of data sorted least to greatest' },
        { name: 'Mode', expression: 'most frequent value', note: '' },
        { name: 'Range', expression: 'max − min', note: '' },
        { name: 'Mean Absolute Deviation', expression: 'MAD = (Σ|x − x̄|) / n', note: '' }
      ]
    }
  ];

  function byKey(key) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].key === key) return TEMPLATES[i];
    return null;
  }

  global.FormulaTemplates = { TEMPLATES: TEMPLATES, byKey: byKey };
})(typeof window !== 'undefined' ? window : global);
