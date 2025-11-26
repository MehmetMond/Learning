import React, { useState, useMemo } from 'react';
import { ArrowDown, ArrowRight, Scale, Search, Timer, TrendingUp } from 'lucide-react';

interface ADCVisualizerProps {
  resolution?: number;
  vRef?: number;
  mode?: 'sar' | 'dual-slope';
}

const ADCVisualizer: React.FC<ADCVisualizerProps> = ({ resolution = 4, vRef = 3.3, mode = 'sar' }) => {
  const [inputVoltage, setInputVoltage] = useState(1.65); // Default to middle

  // --- SAR Logic ---
  const sarSteps = useMemo(() => {
    const steps = [];
    let currentDacVal = 0;
    // ... (bitWeights calculation implicit in loop)

    for (let i = 0; i < resolution; i++) {
      const bitWeight = vRef / Math.pow(2, i + 1);
      const trialVal = currentDacVal + bitWeight;
      
      const kept = inputVoltage >= trialVal;
      if (kept) {
        currentDacVal = trialVal;
      }

      steps.push({
        bitIndex: resolution - 1 - i,
        bitWeight,
        trialVoltage: trialVal,
        decision: kept ? 1 : 0,
        currentApproximation: currentDacVal
      });
    }
    return steps;
  }, [inputVoltage, resolution, vRef]);

  // --- Dual Slope Logic ---
  // T1 is fixed integration time (e.g. 2^N counts)
  // T2 is variable de-integration time
  const t1 = 100; // Arbitrary units for visualization width
  const t2 = (inputVoltage / vRef) * t1;
  const maxT2 = t1; // Assuming max input = vRef
  
  // Digital output for Dual Slope is proportional to T2
  // Let's map T2 to the full scale range defined by resolution
  const dualSlopeMaxCount = Math.pow(2, resolution) - 1;
  const dualSlopeCount = Math.round((t2 / t1) * dualSlopeMaxCount);


  // --- Common Output Calculation ---
  const finalDigitalValue = mode === 'sar' 
    ? sarSteps.reduce((acc, step) => acc + (step.decision << step.bitIndex), 0)
    : dualSlopeCount;

  const finalVoltage = mode === 'sar'
    ? sarSteps[sarSteps.length - 1].currentApproximation
    : (dualSlopeCount / dualSlopeMaxCount) * vRef;

  const quantizationError = inputVoltage - finalVoltage;
  const lsbVoltage = vRef / Math.pow(2, resolution);


  // --- Render SAR Graph ---
  const renderSARGraph = () => {
    const width = 600;
    const height = 300;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const xScale = graphWidth / resolution;
    const yScale = graphHeight / vRef;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Background Grid */}
        <rect x={padding} y={padding} width={graphWidth} height={graphHeight} fill="#111827" stroke="#374151" />
        
        {/* Voltage Levels Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const y = padding + graphHeight - (p * vRef * yScale);
            return (
                <g key={i}>
                    <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#374151" strokeWidth="1" strokeDasharray="4" opacity="0.5" />
                    <text x={padding - 10} y={y + 4} fill="#6b7280" fontSize="10" textAnchor="end">{ (p * vRef).toFixed(2) }V</text>
                </g>
            )
        })}

        {/* Input Voltage Line (Target) */}
        <line 
            x1={padding} 
            y1={padding + graphHeight - (inputVoltage * yScale)} 
            x2={width - padding} 
            y2={padding + graphHeight - (inputVoltage * yScale)} 
            stroke="#ef4444" 
            strokeWidth="2" 
            strokeDasharray="5,5" 
        />
        <text x={width - padding + 10} y={padding + graphHeight - (inputVoltage * yScale) + 4} fill="#ef4444" fontSize="12" fontWeight="bold">U_E</text>

        {/* SAR Steps */}
        <polyline 
            points={sarSteps.map((step, i) => {
                const x = padding + (i * xScale) + (xScale / 2);
                const y = padding + graphHeight - (step.trialVoltage * yScale);
                return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeOpacity="0.5"
        />

        {sarSteps.map((step, i) => {
            const x = padding + (i * xScale) + (xScale / 2);
            const y = padding + graphHeight - (step.trialVoltage * yScale);
            const isKept = step.decision === 1;
            
            return (
                <g key={`step-${i}`}>
                    {/* Step Point */}
                    <circle cx={x} cy={y} r={6} fill={isKept ? "#10b981" : "#6b7280"} stroke="#1f2937" strokeWidth="2" />
                    
                    {/* Comparison Arrow/Label */}
                    <text x={x} y={y - 15} textAnchor="middle" fill={isKept ? "#10b981" : "#6b7280"} fontSize="11" fontWeight="bold">
                        {isKept ? '1' : '0'}
                    </text>
                    
                    {/* Bit Label */}
                    <text x={x} y={height - padding + 20} textAnchor="middle" fill="#9ca3af" fontSize="12" fontFamily="monospace">
                        Bit {step.bitIndex}
                    </text>
                </g>
            );
        })}

        {/* Final Approximation Line */}
        <line 
            x1={padding} 
            y1={padding + graphHeight - (finalVoltage * yScale)} 
            x2={width - padding} 
            y2={padding + graphHeight - (finalVoltage * yScale)} 
            stroke="#10b981" 
            strokeWidth="2" 
            opacity="0.7"
        />
      </svg>
    );
  };

  // --- Render Dual Slope Graph ---
  const renderDualSlopeGraph = () => {
    const width = 600;
    const height = 300;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // X Scale needs to cover T1 + Max T2
    const totalTime = t1 + maxT2;
    const timeScale = graphWidth / totalTime;
    
    // Y Scale (Arbitrary integrator units, let's say peak roughly hits top at max input)
    const peakY = (inputVoltage / vRef) * graphHeight; 

    const t1EndX = padding + t1 * timeScale;
    const t2EndX = t1EndX + t2 * timeScale;
    const peakYPos = padding + graphHeight - peakY;
    const baselineY = padding + graphHeight;

    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            {/* Background Grid */}
            <rect x={padding} y={padding} width={graphWidth} height={graphHeight} fill="#111827" stroke="#374151" />
            
            {/* Zero Line */}
            <line x1={padding} y1={baselineY} x2={width - padding} y2={baselineY} stroke="#6b7280" strokeWidth="1" />
            <text x={padding - 10} y={baselineY + 4} fill="#6b7280" fontSize="10" textAnchor="end">0V</text>

            {/* T1 Phase Area */}
            <path 
                d={`M ${padding} ${baselineY} L ${t1EndX} ${peakYPos} L ${t1EndX} ${baselineY} Z`} 
                fill="url(#grad1)" 
                opacity="0.2" 
            />
            {/* T2 Phase Area */}
            <path 
                d={`M ${t1EndX} ${baselineY} L ${t1EndX} ${peakYPos} L ${t2EndX} ${baselineY} Z`} 
                fill="url(#grad2)" 
                opacity="0.2" 
            />
            
            {/* Integrator Voltage Line */}
            <polyline 
                points={`${padding},${baselineY} ${t1EndX},${peakYPos} ${t2EndX},${baselineY} ${width - padding},${baselineY}`}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinejoin="round"
            />

            {/* T1 Label */}
            <line x1={padding} y1={baselineY + 20} x2={t1EndX} y2={baselineY + 20} stroke="#6b7280" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
            <text x={(padding + t1EndX) / 2} y={baselineY + 35} fill="#34d399" textAnchor="middle" fontSize="12" fontWeight="bold">T1 (Fixed)</text>
            <text x={(padding + t1EndX) / 2} y={baselineY + 50} fill="#6b7280" textAnchor="middle" fontSize="10">Integrate U_E</text>

            {/* T2 Label */}
            <line x1={t1EndX} y1={baselineY + 20} x2={t2EndX} y2={baselineY + 20} stroke="#6b7280" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
            <text x={(t1EndX + t2EndX) / 2} y={baselineY + 35} fill="#f472b6" textAnchor="middle" fontSize="12" fontWeight="bold">T2 (Variable)</text>
            <text x={(t1EndX + t2EndX) / 2} y={baselineY + 50} fill="#6b7280" textAnchor="middle" fontSize="10">De-integrate U_Ref</text>

            {/* Peak Label */}
            <circle cx={t1EndX} cy={peakYPos} r={4} fill="#3b82f6" />
            <text x={t1EndX} y={peakYPos - 10} fill="#3b82f6" textAnchor="middle" fontSize="11" fontWeight="bold">U_x(T1)</text>

            {/* Definitions */}
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                </linearGradient>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
                </marker>
            </defs>
        </svg>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Left Column: Controls & Info */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Input Control */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-lg">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-6 flex items-center">
                <ArrowRight className="w-4 h-4 mr-2 text-blue-500"/> Input Voltage (U_E)
            </h3>
            
            <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 font-mono text-xs">0V</span>
                <span className="text-3xl font-bold text-white font-mono tracking-tighter">{inputVoltage.toFixed(3)}V</span>
                <span className="text-gray-500 font-mono text-xs">{vRef}V</span>
            </div>
            
            <input 
                type="range" 
                min="0" 
                max={vRef} 
                step="0.01" 
                value={inputVoltage} 
                onChange={(e) => setInputVoltage(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
        </div>

        {/* Digital Output Result */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Scale className="w-24 h-24 text-white"/>
             </div>
             <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Digital Output</h3>
             <div className="flex items-baseline space-x-4">
                <div className="text-5xl font-mono font-bold text-emerald-400">
                    {finalDigitalValue.toString(2).padStart(resolution, '0')}
                </div>
                <div className="text-xl text-gray-500 font-mono">
                    (0x{finalDigitalValue.toString(16).toUpperCase()})
                </div>
             </div>
             <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4">
                <div>
                    <div className="text-[10px] text-gray-500 uppercase">Decimal</div>
                    <div className="text-lg font-mono text-white">{finalDigitalValue}</div>
                </div>
                <div>
                    <div className="text-[10px] text-gray-500 uppercase">Approx. Voltage</div>
                    <div className="text-lg font-mono text-white">{finalVoltage.toFixed(4)}V</div>
                </div>
             </div>
        </div>

        {/* Parameters */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-2 text-sm font-mono">
            <div className="flex justify-between">
                <span className="text-gray-500">Mode</span>
                <span className="text-white">{mode === 'sar' ? 'Successive Approx.' : 'Dual Slope'}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-500">V_ref</span>
                <span className="text-yellow-500">{vRef}V</span>
            </div>
            
            {mode === 'sar' ? (
                <>
                    <div className="flex justify-between">
                        <span className="text-gray-500">LSB (U_LSB)</span>
                        <span className="text-blue-300">{lsbVoltage.toFixed(4)}V</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-700 pt-2">
                        <span className="text-gray-500">Quantization Error</span>
                        <span className={`${Math.abs(quantizationError) > lsbVoltage/2 ? 'text-red-400' : 'text-green-400'}`}>
                            {quantizationError > 0 ? '+' : ''}{quantizationError.toFixed(4)}V
                        </span>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex justify-between">
                        <span className="text-gray-500">T1 (Fixed)</span>
                        <span className="text-blue-300">{t1} cycles</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">T2 (Measured)</span>
                        <span className="text-pink-400">{t2.toFixed(1)} cycles</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-700 italic text-center">
                        Result independent of R and C values!
                    </div>
                </>
            )}
        </div>

      </div>

      {/* Center/Right: Visualization */}
      <div className="lg:col-span-2 bg-gray-950 rounded-xl border border-gray-800 p-4 flex flex-col">
         <div className="flex justify-between items-start mb-4 px-2">
            <div>
                <h3 className="text-sm font-bold text-white flex items-center">
                    {mode === 'sar' ? <Search className="w-4 h-4 mr-2 text-purple-400"/> : <TrendingUp className="w-4 h-4 mr-2 text-pink-400"/>}
                    {mode === 'sar' ? 'SAR Approximation Process' : 'Dual Slope Integrator Output'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    {mode === 'sar' ? 'Binary Search Strategy (Wägeverfahren)' : 'Integrate Up (Input), Integrate Down (Ref)'}
                </p>
            </div>
            {mode === 'sar' && (
                <div className="flex space-x-4 text-xs">
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>Input (U_E)</div>
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></div>Kept (1)</div>
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-gray-500 mr-2"></div>Discarded (0)</div>
                </div>
            )}
         </div>
         
         <div className="flex-1 relative min-h-[350px]">
            {mode === 'sar' ? renderSARGraph() : renderDualSlopeGraph()}
         </div>

         {/* Process Explanation Steps */}
         <div className="mt-4">
            {mode === 'sar' ? (
                <div className="grid grid-cols-4 gap-2">
                    {sarSteps.map((step, i) => (
                        <div key={i} className={`p-2 rounded border ${step.decision ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-gray-800 border-gray-700'}`}>
                            <div className="text-[10px] text-gray-500 uppercase mb-1">Cycle {i+1} (Bit {step.bitIndex})</div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-400">Trial:</span>
                                <span className="text-xs font-mono text-blue-300">{step.trialVoltage.toFixed(3)}V</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">U_E &ge; Trial?</span>
                                <span className={`text-xs font-bold ${step.decision ? 'text-emerald-400' : 'text-gray-500'}`}>
                                    {step.decision ? 'YES (1)' : 'NO (0)'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <div className="text-xs text-emerald-400 font-bold mb-1 flex items-center"><Timer className="w-3 h-3 mr-1"/> Phase 1: Run-up</div>
                        <p className="text-xs text-gray-400">
                            Integrate <span className="text-white font-mono">U_E</span> for fixed time <span className="text-white font-mono">T1</span>.
                            Final integrator voltage depends on U_E.
                        </p>
                    </div>
                    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                        <div className="text-xs text-pink-400 font-bold mb-1 flex items-center"><Timer className="w-3 h-3 mr-1"/> Phase 2: Run-down</div>
                        <p className="text-xs text-gray-400">
                            Integrate <span className="text-white font-mono">-U_Ref</span> until output hits 0V.
                            Time <span className="text-white font-mono">T2</span> is proportional to U_E.
                        </p>
                    </div>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ADCVisualizer;