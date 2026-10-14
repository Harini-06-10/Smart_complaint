import { useState } from 'react';

/**
 * v3: Before / After comparison slider.
 * Citizen's photo on the left, worker's proof photo on the right – drag to compare.
 */
export default function BeforeAfter({ before, after, verified }) {
  const [pos, setPos] = useState(50);
  if (!before || !after) return null;
  return (
    <figure className="ba">
      <div className="ba-frame">
        <img src={after} alt="After the fix (worker's proof photo)" className="ba-img" />
        <img src={before} alt="Before (citizen's photo)" className="ba-img" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <div className="ba-line" style={{ left: `${pos}%` }} aria-hidden="true" />
        <span className="ba-tag ba-tag-l">Before</span>
        <span className="ba-tag ba-tag-r">After</span>
        <div className="ba-handle" style={{ left: `${pos}%` }} aria-hidden="true"><span>⇆</span></div>
        <input
          type="range" min="0" max="100" value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="ba-range" aria-label="Drag to compare before and after photos"
        />
      </div>
      <figcaption>
        Drag the slider to compare the citizen&apos;s photo with the worker&apos;s proof.
        {verified === true && <span className="verify verify-ok">✔ Fix GPS-verified on site</span>}
        {verified === false && <span className="verify verify-no">⚠ Fix not verified on site</span>}
      </figcaption>
    </figure>
  );
}
