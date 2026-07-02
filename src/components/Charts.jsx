import { forwardRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const axisColor = '#6B5F54';
const gridColor = '#DCCBB2';

export const OvulationChart = forwardRef(function OvulationChart({ cycles }, ref) {
  const data = cycles
    .filter((c) => c.ovulation?.cycleDay)
    .map((c) => ({ cycle: shortDate(c.startDate), tag: c.ovulation.cycleDay }));

  if (data.length === 0) {
    return <EmptyChart label="Noch keine Ovulationsdaten für ein Diagramm." />;
  }

  return (
    <div ref={ref} style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis dataKey="cycle" stroke={axisColor} fontSize={12} />
          <YAxis stroke={axisColor} fontSize={12} width={40} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #DCCBB2', fontSize: 13 }}
            formatter={(v) => [`Tag ${v}`, 'Ovulation']}
          />
          <Line type="monotone" dataKey="tag" stroke="#7C93A0" strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

export const CycleLengthChart = forwardRef(function CycleLengthChart({ cycles }, ref) {
  const data = cycles
    .filter((c) => typeof c.length === 'number')
    .map((c) => ({ cycle: shortDate(c.startDate), tage: c.length }));

  if (data.length === 0) {
    return (
      <EmptyChart label="Noch kein abgeschlossener Zyklus – die Länge wird automatisch berechnet, sobald der nächste Periodenbeginn eingetragen wird." />
    );
  }

  return (
    <div ref={ref} style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis dataKey="cycle" stroke={axisColor} fontSize={12} />
          <YAxis stroke={axisColor} fontSize={12} width={40} />
          <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #DCCBB2', fontSize: 13 }} />
          <Line type="monotone" dataKey="tage" stroke="#B97A5A" strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

function EmptyChart({ label }) {
  return <div className="empty-state" style={{ padding: '24px 8px' }}>{label}</div>;
}

function shortDate(iso) {
  const [, m, d] = iso.split('-');
  return `${d}.${m}.`;
}
