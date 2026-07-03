import { forwardRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Dot,
} from 'recharts';

const MUCUS_PEAK = 'S+';

const CycleChart = forwardRef(function CycleChart({ cycle }, ref) {
  if (!cycle) {
    return (
      <div className="empty-state" style={{ padding: '24px 8px' }}>
        Noch kein aktiver Zyklus.
      </div>
    );
  }

  const data = cycle.entries.map((e, i) => ({
    day: i + 1,
    date: e.date,
    temp: e.temperature,
    isPeak: e.cervicalMucus === MUCUS_PEAK,
  }));

  const coverline = cycle.ovulation?.thermalShift?.coverline ?? null;

  return (
    <div ref={ref} style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#DCCBB2" strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#6B5F54" fontSize={12} label={{ value: 'Zyklustag', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#6B5F54' }} />
          <YAxis domain={['dataMin - 0.2', 'dataMax + 0.2']} stroke="#6B5F54" fontSize={12} width={44} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #DCCBB2', fontSize: 13 }}
            labelFormatter={(day) => `Zyklustag ${day}`}
            formatter={(v, name) => (name === 'temp' ? [`${v} °C`, 'Temperatur'] : [v, name])}
          />
          {coverline && (
            <ReferenceLine y={coverline} stroke="#B97A5A" strokeDasharray="4 4" label={{ value: 'Coverline', fontSize: 10, fill: '#B97A5A', position: 'right' }} />
          )}
          <Line
            type="monotone"
            dataKey="temp"
            stroke="#7C93A0"
            strokeWidth={2}
            connectNulls
            dot={(props) => <PeakAwareDot {...props} data={data} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

function PeakAwareDot(props) {
  const { cx, cy, payload, index } = props;
  if (cx == null || cy == null) return null;
  const isPeak = payload?.isPeak;
  return (
    <Dot
      key={`dot-${index}`}
      cx={cx}
      cy={cy}
      r={isPeak ? 5 : 3}
      fill={isPeak ? '#A2503C' : '#7C93A0'}
      stroke="none"
    />
  );
}

export default CycleChart;
