import { HISTORY, type CpuSample } from "../activity";

/** Heat step of a CPU share of the whole Mac, relative to one core: below
 *  1 %, a fraction of a core, one core, two cores and more. -1 when not sampled. */
export function heatStep(value: number | undefined, cores: number) {
  if (value === undefined) return -1;
  const core = 100 / Math.max(1, cores);
  if (value < 1) return 0;
  if (value < core * 0.4) return 1;
  if (value < core) return 2;
  if (value < core * 2) return 3;
  return 4;
}

/** Thresholds shown by the heat legend, in % of the whole Mac. */
export function heatThresholds(cores: number) {
  const core = 100 / Math.max(1, cores);
  return [1, core * 0.4, core, core * 2];
}

/** The last two minutes of one line, one square per sample. */
export function HeatStrip({
  values,
  cores,
}: {
  values: (number | undefined)[];
  cores: number;
}) {
  const padded = [
    ...Array<undefined>(Math.max(0, HISTORY - values.length)).fill(undefined),
    ...values.slice(-HISTORY),
  ];
  return (
    <span className="heat-strip" aria-hidden="true">
      {padded.map((v, i) => (
        <i key={i} className={`h${heatStep(v, cores)}`} />
      ))}
    </span>
  );
}

const path = (tops: number[], bottoms: number[], offset: number) => {
  const up = tops.map(
    (v, i) => `${i ? "L" : "M"}${offset + i} ${100 - v}H${offset + i + 1}`,
  );
  const down = bottoms
    .map((v, i) => `L${offset + i + 1} ${100 - v}H${offset + i}`)
    .reverse();
  return `${up.join("")}${down.join("")}Z`;
};

/** CPU of the whole Mac over two minutes: programs, then the kernel on top. */
export function CpuChart({
  history,
  label,
}: {
  history: CpuSample[];
  label: string;
}) {
  const samples = history.slice(-HISTORY);
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const programs = samples.map((h) => clamp(h.programs));
  const total = samples.map((h, i) => clamp(programs[i] + h.kernel));
  const offset = HISTORY - samples.length;
  const last = total.at(-1);
  return (
    <div className="cpu-chart" role="img" aria-label={label}>
      <span className="grid-line" style={{ top: "0%" }} />
      <span className="grid-line" style={{ top: "50%" }} />
      <span className="y-label" style={{ top: "0%" }}>
        100
      </span>
      <span className="y-label" style={{ top: "50%" }}>
        50
      </span>
      <span className="y-label" style={{ top: "100%" }}>
        0
      </span>
      {samples.length > 0 && (
        <svg viewBox={`0 0 ${HISTORY} 100`} preserveAspectRatio="none">
          <path
            className="area-programs"
            d={path(
              programs,
              programs.map(() => 0),
              offset,
            )}
          />
          <path className="area-kernel" d={path(total, programs, offset)} />
        </svg>
      )}
      <span className="now-line" />
      {last !== undefined && (
        <span
          className="end-label mono"
          style={{ top: `${Math.min(88, Math.max(0, 100 - last - 12))}%` }}
        >
          {Math.round(last)} %
        </span>
      )}
    </div>
  );
}
