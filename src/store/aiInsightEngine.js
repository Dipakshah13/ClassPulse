/**
 * aiInsightEngine.js
 * ─────────────────────────────────────────────────────────────
 * Generates contextual AI insights for student questions using
 * keyword analysis. Works 100% client-side — no API key needed.
 *
 * Each RULE contains:
 *   keywords  - strings to match in the question (case-insensitive)
 *   topic     - displayed tag (e.g. "React Hooks")
 *   color     - 'tertiary' | 'secondary' | 'primary' | 'error'
 *   badge     - demand level label
 *   badgeType - 'high' | 'emerging' | 'info' | null
 *   insight   - the AI-generated explanation shown to the teacher
 */

const RULES = [
  // ── React / Hooks ────────────────────────────────────────────
  {
    keywords: ['useeffect', 'use effect', 'dependency array', 'dependencies'],
    topic: 'React Hooks',
    color: 'tertiary',
    badge: 'High Demand',
    badgeType: 'high',
    insight: 'Dependency checks use referential equality. Suggest demonstrating useMemo or useCallback to stabilize references and prevent infinite re-render loops.',
  },
  {
    keywords: ['usestate', 'use state', 'state update', 'setState', 'state not updating'],
    topic: 'React State',
    color: 'tertiary',
    badge: 'Frequent',
    badgeType: 'high',
    insight: 'React state updates are asynchronous. Students often expect immediate mutation. A live demo of the stale closure problem and functional updater form can resolve confusion.',
  },
  {
    keywords: ['useref', 'use ref', 'ref', 'dom element', 'focus'],
    topic: 'React Refs',
    color: 'secondary',
    badge: 'Emerging',
    badgeType: 'emerging',
    insight: 'useRef persists values across renders without triggering re-renders. Great for DOM manipulation or storing mutable values like timer IDs.',
  },
  {
    keywords: ['usecontext', 'context', 'context api', 'prop drilling'],
    topic: 'React Context',
    color: 'secondary',
    badge: 'Emerging',
    badgeType: 'emerging',
    insight: 'Context avoids prop-drilling but re-renders all consumers on change. Recommend splitting context into smaller slices or using memo to optimize.',
  },
  {
    keywords: ['usememo', 'usecallback', 'memoiz', 'memo', 'performance', 'optimiz'],
    topic: 'React Performance',
    color: 'primary',
    badge: 'Advanced',
    badgeType: 'info',
    insight: 'useMemo caches computed values; useCallback caches functions. Both are only needed when referential identity matters — e.g. as dependencies or props to React.memo components.',
  },
  {
    keywords: ['component', 'render', 're-render', 'rerender', 'props'],
    topic: 'React Core',
    color: 'primary',
    badge: 'Fundamental',
    badgeType: 'info',
    insight: 'Components re-render when state or props change. Understanding the virtual DOM diff algorithm helps students reason about when renders are triggered.',
  },
  // ── JavaScript Async ─────────────────────────────────────────
  {
    keywords: ['async', 'await', 'promise', 'then', 'asynchronous'],
    topic: 'Async JavaScript',
    color: 'secondary',
    badge: 'Emerging',
    badgeType: 'emerging',
    insight: 'async/await is syntactic sugar over Promises. Remind students to always wrap await in try/catch and to avoid await inside useEffect directly — define an inner async function instead.',
  },
  {
    keywords: ['fetch', 'api call', 'http', 'request', 'axios', 'rest'],
    topic: 'API / Fetch',
    color: 'secondary',
    badge: 'Common',
    badgeType: 'info',
    insight: 'fetch() returns a Promise. Students frequently forget to call .json() to parse the response body. Show the two-step await pattern and error handling with response.ok.',
  },
  {
    keywords: ['callback', 'event loop', 'microtask', 'macrotask', 'settimeout'],
    topic: 'JS Event Loop',
    color: 'tertiary',
    badge: 'High Demand',
    badgeType: 'high',
    insight: 'The event loop is a key conceptual hurdle. A visual diagram of call stack, microtask queue, and callback queue often resolves confusion more effectively than verbal explanation.',
  },
  // ── JavaScript Core ───────────────────────────────────────────
  {
    keywords: ['closure', 'scope', 'lexical', 'outer function'],
    topic: 'JS Closures',
    color: 'tertiary',
    badge: 'Frequent',
    badgeType: 'high',
    insight: 'Closures give functions access to their outer scope even after the outer function has returned. Common gotcha: loop closures capturing the same variable reference. Suggest using let or function factories.',
  },
  {
    keywords: ['hoisting', 'var', 'let', 'const', 'temporal dead zone', 'tdz'],
    topic: 'JS Scoping',
    color: 'primary',
    badge: 'Fundamental',
    badgeType: 'info',
    insight: 'var is function-scoped and hoisted with undefined; let/const are block-scoped and hoisted but not initialized (temporal dead zone). Recommend avoiding var entirely in modern code.',
  },
  {
    keywords: ['this', 'bind', 'arrow function', 'context'],
    topic: 'JS this Keyword',
    color: 'tertiary',
    badge: 'High Demand',
    badgeType: 'high',
    insight: 'Arrow functions do not have their own "this" — they inherit from the enclosing lexical scope. This makes them ideal for callbacks but unsuitable for object methods that need dynamic "this".',
  },
  {
    keywords: ['prototype', 'class', 'inheritance', 'extends', 'super'],
    topic: 'OOP / Prototype',
    color: 'primary',
    badge: 'Advanced',
    badgeType: 'info',
    insight: 'ES6 classes are syntax sugar over prototype chains. Demonstrate how Object.getPrototypeOf() reveals the chain. Students often confuse class-based with true classical inheritance.',
  },
  {
    keywords: ['spread', 'rest', 'destructur', '...'],
    topic: 'ES6 Syntax',
    color: 'secondary',
    badge: 'Common',
    badgeType: 'info',
    insight: 'Spread creates shallow copies; rest collects remaining elements. A live demo showing that nested objects are still shared references (shallow copy pitfall) clarifies expected behavior.',
  },
  // ── CSS / Styling ─────────────────────────────────────────────
  {
    keywords: ['flexbox', 'flex', 'align-items', 'justify-content'],
    topic: 'CSS Flexbox',
    color: 'secondary',
    badge: 'Common',
    badgeType: 'info',
    insight: 'Flexbox confusion often stems from mixing up main-axis vs cross-axis. A quick visual reference showing how flex-direction changes axis orientation resolves most layout issues.',
  },
  {
    keywords: ['grid', 'css grid', 'grid-template', 'grid-column'],
    topic: 'CSS Grid',
    color: 'secondary',
    badge: 'Emerging',
    badgeType: 'emerging',
    insight: 'CSS Grid excels at 2D layouts while Flexbox handles 1D. Emphasize grid-template-areas for readable layout definitions and fr units for flexible sizing.',
  },
  {
    keywords: ['position', 'absolute', 'relative', 'fixed', 'sticky', 'z-index'],
    topic: 'CSS Positioning',
    color: 'primary',
    badge: 'Frequent',
    badgeType: 'info',
    insight: 'Positioned elements (non-static) create a new stacking context. z-index only works on positioned elements. Absolute positioning removes the element from normal flow relative to its nearest positioned ancestor.',
  },
  // ── TypeScript ────────────────────────────────────────────────
  {
    keywords: ['typescript', 'type', 'interface', 'generic', 'ts', '.tsx'],
    topic: 'TypeScript',
    color: 'primary',
    badge: 'Advanced',
    badgeType: 'info',
    insight: 'TypeScript adds static typing to JavaScript. Interfaces describe object shapes; generics allow type-safe reusable functions. Recommend starting with strict: true in tsconfig for best practice.',
  },
  // ── Routing ──────────────────────────────────────────────────
  {
    keywords: ['router', 'route', 'navigate', 'link', 'path', 'url param', 'useparams'],
    topic: 'React Router',
    color: 'secondary',
    badge: 'Common',
    badgeType: 'info',
    insight: 'React Router v6 uses element-based routes and nested routing. useParams extracts URL segments; useNavigate replaces the old history.push pattern for programmatic navigation.',
  },
  // ── State Management ─────────────────────────────────────────
  {
    keywords: ['redux', 'zustand', 'jotai', 'recoil', 'global state', 'store'],
    topic: 'State Management',
    color: 'tertiary',
    badge: 'Advanced',
    badgeType: 'info',
    insight: 'Global state tools shine when multiple unrelated components share data. Recommend Context + useReducer before introducing Redux or Zustand to ensure students understand the underlying problem being solved.',
  },
  // ── General / Fallback ────────────────────────────────────────
  {
    keywords: ['error', 'bug', 'undefined', 'null', 'cannot read', 'not a function'],
    topic: 'Debugging',
    color: 'error',
    badge: 'Needs Attention',
    badgeType: 'high',
    insight: 'This sounds like a runtime error. Encourage students to read the full error message and stack trace. A live debugging session using browser DevTools breakpoints could benefit the whole class.',
  },
  {
    keywords: ['why', 'what is', 'what does', 'explain', 'how does', 'difference between'],
    topic: 'Conceptual',
    color: 'primary',
    badge: 'Clarification Needed',
    badgeType: 'info',
    insight: 'Conceptual question detected. Consider pausing for a brief analogy-based explanation or a Q&A moment. These questions often indicate that several other students share the same uncertainty.',
  },
];

const FALLBACK = {
  topic: 'General',
  color: 'on-surface-variant',
  badge: null,
  badgeType: null,
  insight: 'No specific pattern detected. Consider revisiting this topic in the next summary segment or addressing it during the Q&A window.',
};

/**
 * Analyze a question string and return an AI insight object.
 * @param {string} text - The student question text
 * @returns {{ topic, color, badge, badgeType, insight }}
 */
export function generateInsight(text) {
  const lower = text.toLowerCase();

  // Count keyword matches per rule to find best fit
  let bestRule = null;
  let bestScore = 0;

  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  if (!bestRule || bestScore === 0) return { ...FALLBACK };

  return {
    topic:     bestRule.topic,
    color:     bestRule.color,
    badge:     bestRule.badge,
    badgeType: bestRule.badgeType,
    insight:   bestRule.insight,
  };
}
