import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

interface MarketChartProps {
    data: any[];
    options: string[];
}

const COLORS = [
    "#3b82f6", // Blue
    "#ef4444", // Red
    "#10b981", // Green
    "#f59e0b", // Yellow
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#f97316", // Orange
];

const MarketChart = ({ data, options }: MarketChartProps) => {
    if (!data || data.length === 0) return null;

    // Use passed options for count, fallback to data if needed
    const numOptions = options.length > 0 ? options.length : 2;

    // Format data
    const formattedData = data.map(d => {
        const prices = JSON.parse(d.option_prices || "[]");
        const point: any = {
            date: new Date(d.timestamp).toLocaleDateString() + " " + new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            raw_timestamp: d.timestamp,
        };

        if (Array.isArray(prices)) {
            prices.forEach((p: number, idx: number) => {
                point[`option_${idx}`] = Math.round(p * 100);
            });
        }
        return point;
    });

    return (
        <div className="h-[300px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData}>
                    <defs>
                        {Array.from({ length: numOptions }).map((_, idx) => (
                            <linearGradient key={idx} id={`colorOption${idx}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#9ca3af"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        stroke="#9ca3af"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        unit="%"
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: any, name: any) => [`${value}%`, name]}
                        labelStyle={{ color: '#9ca3af', marginBottom: '0.5rem' }}
                    />
                    <Legend />
                    {Array.from({ length: numOptions }).map((_, idx) => (
                        <Area
                            key={idx}
                            type="monotone"
                            dataKey={`option_${idx}`}
                            stroke={COLORS[idx % COLORS.length]}
                            strokeWidth={2}
                            fillOpacity={0.6}
                            fill={`url(#colorOption${idx})`}
                            name={options[idx] || `Option ${idx + 1}`}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MarketChart;
