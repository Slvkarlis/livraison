/**
 * Ville aerienne en 3D (conception Doop « CityMap3D ») : plan incline en perspective,
 * immeubles extrudes qui s'elevent, itineraire ambre en pointilles qui defile,
 * reperes flottants. Purement decoratif : aria-hidden.
 */
const ILOTS = [
  [30, 40, 120, 90], [180, 40, 90, 150], [300, 60, 140, 80], [470, 30, 100, 130], [40, 170, 110, 140],
  [300, 170, 80, 120], [410, 190, 160, 90], [30, 350, 150, 90], [210, 320, 110, 160], [350, 330, 120, 100],
  [500, 320, 80, 170], [40, 480, 130, 90], [350, 460, 120, 110],
];
const TOURS: { x: number; y: number; l: number; p: number; h: number }[] = [
  { x: 5, y: 6.7, l: 20, p: 15, h: 46 }, { x: 78.3, y: 5, l: 16.7, p: 21.7, h: 92 },
  { x: 68.3, y: 31.7, l: 26.7, p: 15, h: 38 }, { x: 35, y: 53.3, l: 18.3, p: 26.7, h: 70 },
  { x: 58.3, y: 76.7, l: 20, p: 18.3, h: 54 },
];
const TRACE = 'M90 560 L90 330 L195 330 L195 160 L395 160 L395 300 L540 300';

export function CarteVille3D({ ton = 'nuit', className = '' }: { ton?: 'nuit' | 'jour'; className?: string }) {
  return (
    <div className={`cm ${className}`} data-ton={ton} aria-hidden="true">
      <div className="cm-plan">
        <svg className="cm-rues" viewBox="0 0 600 600" preserveAspectRatio="none">
          <g className="cm-ilots">{ILOTS.map(([x, y, l, h], i) => <rect key={i} x={x} y={y} width={l} height={h} rx="8" />)}</g>
          <path className="cm-fleuve" d="M-20 520 C120 470 200 560 330 500 S520 440 640 470" />
          <path className="cm-trace-fond" d={TRACE} />
          <path className="cm-trace" d={TRACE} />
        </svg>
        {TOURS.map((t, i) => (
          <i key={i} className="cm-tour" style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.l}%`, height: `${t.p}%`, ['--h' as string]: `${t.h}px`, animationDelay: `${i * 0.1}s` }}>
            <s className="t" /><s className="f" /><s className="r" />
          </i>
        ))}
      </div>
      <span className="cm-repere depart" style={{ left: '24%', top: '72%' }}><b /></span>
      <span className="cm-repere arret" style={{ left: '47%', top: '40%' }}><b /></span>
      <span className="cm-repere arrivee" style={{ left: '76%', top: '50%' }}><b /></span>
      <span className="cm-voile" />
    </div>
  );
}
