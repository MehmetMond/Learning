import React, { useMemo } from 'react';

interface DACVisualizerProps {
  resolution: number; // Fixed to 4 for this visualizer usually
  vRef: number;
  value: number;
  onChange: (newValue: number) => void;
}

const DACVisualizer: React.FC<DACVisualizerProps> = ({ resolution = 4, vRef, value, onChange }) => {
  const maxVal = Math.pow(2, resolution) - 1;
  const stepSize = vRef / Math.pow(2, resolution);
  const outputVoltage = value * stepSize;

  // Extract bits for the UI
  const bits = useMemo(() => {
    const b = [];
    for (let i = resolution - 1; i >= 0; i--) {
      b.push((value >> i) & 1);
    }
    return b;
  }, [value, resolution]);

  const toggleBit = (bitIndexReverse: number) => {
    const bitIndex = resolution - 1 - bitIndexReverse;
    const mask = 1 << bitIndex;
    const newValue = value ^ mask;
    onChange(newValue);
  };

  // --- R-2R Ladder SVG Renderer ---
  const renderLadder = () => {
    // Reduced width and adjusted spacing to "zoom in" and make elements look larger
    const width = 700; 
    const height = 350;
    const startX = 80; // Shifted left to utilize space better
    const sectionWidth = 140; // Compacted slightly to fit new width
    
    const elements = [];

    // Labels for Rails
    elements.push(<text key="vref-lbl" x={10} y={height - 65} fill="#fbbf24" fontSize="12" fontWeight="bold" fontFamily="monospace">Vref ({vRef}V)</text>);
    elements.push(<text key="gnd-lbl" x={10} y={height - 15} fill="#9ca3af" fontSize="12" fontWeight="bold" fontFamily="monospace">GND (0V)</text>);

    // Draw Rails
    elements.push(<line key="rail-v-main" x1={20} y1={height - 70} x2={width - 40} y2={height - 70} stroke="#fbbf24" strokeWidth="1" strokeDasharray="4" opacity="0.3" />);
    elements.push(<line key="rail-g-main" x1={20} y1={height - 20} x2={width - 40} y2={height - 20} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4" opacity="0.3" />);

    // Render Nodes (0 to N-1)
    for(let i = 0; i < resolution; i++) {
        const cx = startX + i * sectionWidth;
        const topY = 80;

        const bitIndex = i;
        const bitValue = (value >> bitIndex) & 1;
        const isActive = bitValue === 1;

        // Node Dot
        elements.push(<circle key={`node-${i}`} cx={cx} cy={topY} r={4} fill="#d1d5db" />);
        elements.push(<text key={`node-lbl-${i}`} x={cx} y={topY - 15} textAnchor="middle" fill="#6b7280" fontSize="10">N{i}</text>);

        // 1. Vertical Resistor (2R) to Switch
        elements.push(
            <g key={`v-res-${i}`}>
                 <line x1={cx} y1={topY} x2={cx} y2={topY + 30} stroke={isActive ? "#10b981" : "#4b5563"} strokeWidth="2" />
                 {/* Resistor Box */}
                 <rect x={cx - 8} y={topY + 30} width={16} height={40} fill="#1f2937" stroke={isActive ? "#10b981" : "#4b5563"} strokeWidth="2" rx="2" />
                 <text x={cx + 14} y={topY + 55} fill={isActive ? "#10b981" : "#6b7280"} fontSize="11" fontFamily="monospace">2R</text>
                 <line x1={cx} y1={topY + 70} x2={cx} y2={topY + 110} stroke={isActive ? "#10b981" : "#4b5563"} strokeWidth="2" />
            </g>
        );

        // 2. Switch Mechanism
        const swY = topY + 110;
        const targetY = isActive ? height - 70 : height - 20; // Connect to Vref or GND
        elements.push(
            <g key={`sw-${i}`}>
                {/* Switch Pivot */}
                <circle cx={cx} cy={swY} r={3} fill="#4b5563" />
                {/* Switch Arm */}
                <line 
                    x1={cx} y1={swY} 
                    x2={cx} y2={targetY} 
                    stroke={isActive ? "#10b981" : "#ef4444"} 
                    strokeWidth="3" 
                    className="transition-all duration-300 ease-in-out"
                />
                {/* Connection Point */}
                <circle cx={cx} cy={targetY} r={3} fill={isActive ? "#fbbf24" : "#ef4444"} />
                
                {/* Switch Label */}
                <text x={cx} y={height + 5} textAnchor="middle" fill={isActive ? "#10b981" : "#6b7280"} fontSize="14" fontWeight="bold" fontFamily="monospace">
                    b{i}
                </text>
                <text x={cx} y={height + 20} textAnchor="middle" fill={isActive ? "#10b981" : "#4b5563"} fontSize="10">
                    {isActive ? 'High' : 'Low'}
                </text>
            </g>
        );

        // 3. Horizontal Resistor (R) to next node (if not last)
        if (i < resolution - 1) {
            const nextCx = startX + (i + 1) * sectionWidth;
            const midX = (cx + nextCx) / 2;
            elements.push(
                <g key={`h-res-${i}`}>
                    <line x1={cx} y1={topY} x2={midX - 20} y2={topY} stroke="#4b5563" strokeWidth="2" />
                    <rect x={midX - 20} y={topY - 8} width={40} height={16} fill="#1f2937" stroke="#4b5563" strokeWidth="2" rx="2" />
                    <text x={midX} y={topY - 14} textAnchor="middle" fill="#9ca3af" fontSize="11" fontFamily="monospace">R</text>
                    <line x1={midX + 20} y1={topY} x2={nextCx} y2={topY} stroke="#4b5563" strokeWidth="2" />
                </g>
            );
        }

        // 4. Termination 2R (Only at Node 0 / LSB)
        if (i === 0) {
            elements.push(
                <g key="term">
                    <line x1={cx} y1={topY} x2={cx - 30} y2={topY} stroke="#4b5563" strokeWidth="2" />
                    <line x1={cx - 30} y1={topY} x2={cx - 30} y2={topY + 20} stroke="#4b5563" strokeWidth="2" />
                    <rect x={cx - 38} y={topY + 20} width={16} height={40} fill="#1f2937" stroke="#4b5563" strokeWidth="2" rx="2" />
                    <text x={cx - 45} y={topY + 45} fill="#9ca3af" fontSize="11" fontFamily="monospace" textAnchor="end">2R</text>
                    <line x1={cx - 30} y1={topY + 60} x2={cx - 30} y2={topY + 80} stroke="#4b5563" strokeWidth="2" />
                    
                    {/* Ground Symbol */}
                    <line x1={cx - 40} y1={topY + 80} x2={cx - 20} y2={topY + 80} stroke="#9ca3af" strokeWidth="2" />
                    <line x1={cx - 35} y1={topY + 84} x2={cx - 25} y2={topY + 84} stroke="#9ca3af" strokeWidth="2" />
                    <line x1={cx - 30} y1={topY + 88} x2={cx - 30} y2={topY + 88} stroke="#9ca3af" strokeWidth="2" />
                </g>
            );
        }
    }

    // Output Line (from last node)
    const lastCx = startX + (resolution - 1) * sectionWidth;
    const topY = 80;
    elements.push(
        <g key="output">
            <line x1={lastCx} y1={topY} x2={width - 60} y2={topY} stroke="#3b82f6" strokeWidth="3" />
            <circle cx={width - 60} cy={topY} r={5} fill="#3b82f6" />
            <text x={width - 60} y={topY - 15} textAnchor="end" fill="#3b82f6" fontWeight="bold" fontSize="16">Vout</text>
        </g>
    );

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height + 30}`} className="overflow-visible select-none" preserveAspectRatio="xMidYMid meet">
            {elements}
        </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Left: Controls & Circuit */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Register View - Compacted */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 shadow-lg">
                <div className="flex justify-between items-center mb-2">
                     <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">DAC Input Register</h3>
                     <div className="text-xl font-mono font-bold text-blue-400">
                        0x{value.toString(16).toUpperCase().padStart(1, '0')} <span className="text-gray-600 text-xs ml-2">({value} dec)</span>
                     </div>
                </div>
                
                <div className="flex justify-center space-x-6">
                    {bits.map((bit, idx) => {
                        const actualBitIndex = resolution - 1 - idx;
                        return (
                        <div key={idx} className="flex flex-col items-center space-y-1">
                            <div className="text-[10px] text-gray-500">b{actualBitIndex}</div>
                            <button
                                onClick={() => toggleBit(idx)}
                                className={`w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-150 relative overflow-hidden ${
                                    bit 
                                    ? 'bg-blue-900/30 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                                    : 'bg-gray-900 border-gray-600 text-gray-600 hover:border-gray-500'
                                }`}
                            >
                                <span className="text-lg font-bold font-mono">{bit}</span>
                                <div className={`absolute bottom-0 w-full h-1 ${bit ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                            </button>
                            <span className="text-[10px] text-gray-500 font-mono">
                                2^{actualBitIndex}
                            </span>
                        </div>
                    )})}
                </div>
            </div>

            {/* Circuit Diagram - Enlarged */}
            <div className="bg-gray-950 rounded-xl border border-gray-800 p-4 relative min-h-[450px] flex items-center justify-center overflow-hidden">
                <div className="absolute top-3 left-4 text-xs text-gray-500 uppercase tracking-wider">
                    R-2R Ladder <span className="text-gray-600 mx-1">|</span> Wägeverfahren
                </div>
                <div className="w-full h-full flex items-center justify-center">
                     {renderLadder()}
                </div>
            </div>
        </div>

        {/* Right: Analysis */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* Voltmeter */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none"></div>
                <h3 className="text-gray-400 text-xs uppercase tracking-widest mb-3">Analog Output (U_A)</h3>
                <div className="text-5xl font-mono font-bold text-white tracking-tighter drop-shadow-2xl">
                    {outputVoltage.toFixed(3)}
                    <span className="text-2xl text-gray-500 ml-2">V</span>
                </div>
                
                {/* Analog Gauge */}
                <div className="mt-6 w-full relative h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                    {/* Ticks */}
                    <div className="absolute top-0 left-0 w-full h-full flex justify-between px-1">
                        {[0, 0.25, 0.5, 0.75, 1].map(t => (
                            <div key={t} className="w-px h-full bg-gray-600 opacity-30"></div>
                        ))}
                    </div>
                    <div 
                        className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                        style={{ width: `${(outputVoltage / vRef) * 100}%` }}
                    ></div>
                </div>
                <div className="flex justify-between w-full text-[10px] text-gray-500 mt-1 font-mono">
                    <span>0V</span>
                    <span>{vRef}V</span>
                </div>
            </div>

            {/* Transfer Function Graph */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 shadow-lg">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Transfer Function</h3>
                <div className="relative w-full h-40 border-l border-b border-gray-600 ml-2">
                    {/* Axes Labels */}
                    <div className="absolute -left-6 top-0 text-[10px] text-gray-500">Vref</div>
                    <div className="absolute -left-4 bottom-0 text-[10px] text-gray-500">0</div>

                    <svg className="absolute inset-0 w-full h-full overflow-visible">
                        {/* Ideal Line */}
                        <line x1="0" y1="100%" x2="100%" y2="0" stroke="#4b5563" strokeDasharray="2" strokeWidth="1" />
                        
                        {/* Steps */}
                        {Array.from({ length: maxVal + 1 }).map((_, i) => {
                            const x = (i / maxVal) * 100;
                            const y = 100 - ((i * stepSize) / vRef) * 100;
                            const isCurrent = i === value;
                            return (
                                <g key={i}>
                                    <line 
                                        x1={`${x}%`} y1={`${y}%`} 
                                        x2={`${x}%`} y2="100%" 
                                        stroke={isCurrent ? "#3b82f6" : "transparent"} 
                                        strokeWidth="1" 
                                        strokeOpacity="0.3"
                                    />
                                    <circle 
                                        cx={`${x}%`} cy={`${y}%`} 
                                        r={isCurrent ? 5 : 2} 
                                        fill={isCurrent ? "#3b82f6" : "#4b5563"} 
                                        className="transition-all duration-300"
                                    />
                                    {isCurrent && (
                                        <circle 
                                            cx={`${x}%`} cy={`${y}%`} 
                                            r={8} 
                                            fill="none" 
                                            stroke="#3b82f6" 
                                            strokeOpacity="0.8" 
                                            strokeWidth="2"
                                            className="animate-pulse" 
                                        />
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2 ml-2 font-mono">
                    <span>0000</span>
                    <span>Input Code</span>
                    <span>1111</span>
                </div>
            </div>

            {/* Math Explanation */}
            <div className="bg-gray-900/50 rounded-lg border border-blue-500/30 p-4 backdrop-blur-sm">
                <h4 className="text-blue-300 font-bold text-xs uppercase mb-2 tracking-wider">Calculation</h4>
                <div className="font-mono text-xs text-gray-300 space-y-2">
                    <div className="flex justify-between border-b border-gray-700 pb-1">
                        <span className="text-gray-500">Formula:</span>
                        <span>U_A = U_ref × (D / 2^N)</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">U_ref:</span>
                        <span className="text-yellow-500">{vRef}V</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-gray-500">D (Decimal):</span>
                        <span className="text-blue-400">{value}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-gray-500">Resolution (N):</span>
                        <span>{resolution} bits</span>
                    </div>
                    <div className="pt-2 border-t border-gray-700 text-right">
                        <span className="text-gray-400">{vRef} × ({value} / 16) = </span>
                        <span className="text-white font-bold text-sm">{outputVoltage.toFixed(4)}V</span>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default DACVisualizer;