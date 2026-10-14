/**
 * AI Complaint Classifier
 * -----------------------
 * 1. CATEGORY – Multinomial Naive Bayes text classifier (with Laplace smoothing),
 *    trained at start-up on ./trainingData.js. Pure JavaScript, no external API.
 * 2. PRIORITY – Hybrid rule engine: category base risk + urgency keywords
 *    (danger, accident, child, hospital…) + public-impact keywords.
 */
const trainingData = require('./trainingData');
const { CATEGORIES } = require('../config/constants');

const STOP_WORDS = new Set(
  'a an the is are was were be been in on at of for to and or but with this that it its our my we i from by as has have had not no near there their very so too all any can will'.split(
    ' '
  )
);

function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9஀-௿\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, '')); // light stemming
}

// ---------------- Train Naive Bayes ----------------
const model = { classDocs: {}, wordCounts: {}, totalWords: {}, vocab: new Set(), totalDocs: 0 };

function train(samples) {
  for (const [text, label] of samples) {
    model.totalDocs += 1;
    model.classDocs[label] = (model.classDocs[label] || 0) + 1;
    model.wordCounts[label] = model.wordCounts[label] || {};
    model.totalWords[label] = model.totalWords[label] || 0;
    for (const token of tokenize(text)) {
      model.vocab.add(token);
      model.wordCounts[label][token] = (model.wordCounts[label][token] || 0) + 1;
      model.totalWords[label] += 1;
    }
  }
}
train(trainingData);

function predictCategory(text) {
  const tokens = tokenize(text);
  const V = model.vocab.size;
  const scores = {};

  for (const label of Object.keys(model.classDocs)) {
    let logProb = Math.log(model.classDocs[label] / model.totalDocs);
    for (const t of tokens) {
      const count = (model.wordCounts[label][t] || 0) + 1; // Laplace smoothing
      logProb += Math.log(count / (model.totalWords[label] + V));
    }
    scores[label] = logProb;
  }

  // Softmax → probabilities
  const max = Math.max(...Object.values(scores));
  const exp = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.exp(v - max)]));
  const sum = Object.values(exp).reduce((a, b) => a + b, 0);
  const ranked = Object.entries(exp)
    .map(([label, v]) => ({ category: label, probability: v / sum }))
    .sort((a, b) => b.probability - a.probability);

  const known = tokens.some((t) => model.vocab.has(t));
  return { ranked, known };
}

// ---------------- Priority rules ----------------
const CATEGORY_BASE_RISK = {
  'Exposed Electric Wire': 3,
  'Fallen Tree': 2.5,
  'Traffic Signal Damage': 2.5,
  'Drainage Blockage': 2,
  Pothole: 2,
  'Water Leakage': 2,
  'Road Damage': 1.5,
  'Garbage Accumulation': 1.5,
  'Streetlight Not Working': 1.5,
  'Damaged Public Property': 1.5,
  Other: 1,
};

const URGENT_WORDS = [
  'danger', 'dangerous', 'accident', 'electrocut', 'spark', 'fire', 'live wire', 'injur',
  'death', 'died', 'collapse', 'flood', 'emergency', 'urgent', 'immediately', 'blocking',
  'blocked traffic', 'fallen on', 'child', 'children', 'school', 'hospital', 'ambulance', 'women',
];
const IMPACT_WORDS = ['whole street', 'entire area', 'many people', 'days', 'weeks', 'everyone', 'main road', 'junction', 'market'];

function predictPriority(text, category) {
  const lower = (text || '').toLowerCase();
  let score = CATEGORY_BASE_RISK[category] ?? 1;
  const matched = [];

  for (const w of URGENT_WORDS) if (lower.includes(w)) { score += 1.5; matched.push(w); }
  for (const w of IMPACT_WORDS) if (lower.includes(w)) { score += 0.5; matched.push(w); }

  let priority = 'Low';
  if (score >= 5.5) priority = 'Critical';
  else if (score >= 3.5) priority = 'High';
  else if (score >= 1.5) priority = 'Medium';

  return { priority, score: Number(score.toFixed(1)), keywords: [...new Set(matched)] };
}

/** Full prediction used by the API and on complaint submission. */
function analyze(text) {
  const { ranked, known } = predictCategory(text);
  const top = ranked[0];
  const category = known && CATEGORIES[top.category] ? top.category : 'Other';
  const { priority, score, keywords } = predictPriority(text, category);

  return {
    category,
    department: CATEGORIES[category],
    confidence: known ? Number(top.probability.toFixed(2)) : 0,
    alternatives: ranked.slice(1, 3).map((r) => ({ category: r.category, probability: Number(r.probability.toFixed(2)) })),
    priority,
    urgencyScore: score,
    urgencyKeywords: keywords,
  };
}

module.exports = { analyze, predictPriority, tokenize };
