import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface MarketChartProps {
    data: any[];
}

const MarketChart = ({ data }: MarketChartProps) => {
    // Transform data to percentages for display if needed, or better, 
    // chart expects specific format. 
    // Data from backend: { timestamp: string, yes_price: number, contract_id: number, id: number }

    // Format timestamp
    const formattedData = data.map(d => ({
        ...d,
        date: new Date(d.timestamp).toLocaleDateString(),
        yes_percent: Math.round(d.yes_price * 100),
        no_percent: Math.round((1 - d.yes_price) * 100)
    }));

    return (
        <div className="h-[300px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData}>
                    <defs>
                        <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorNo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#9ca3af"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
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
                    />
                    <Area
                        type="monotone"
                        dataKey="yes_percent"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorYes)"
                        name="Yes"
                    />
                    <Area
                        type="monotone"
                        dataKey="no_percent"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorNo)"
                        name="No"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MarketChart;
