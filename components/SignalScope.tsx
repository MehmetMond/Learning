import React, { useMemo } from 'react';
import { SignalFrame, I2CSignalFrame, SPISignalFrame, Protocol } from '../types';

interface SignalScopeProps {
  protocol: Protocol;
  frames: (SignalFrame | I2CSignalFrame | SPISignalFrame)[];
  currentIndex: number;
}

const SignalScope: React.FC<SignalScopeProps> = ({ protocol, frames, currentIndex }) => {
  const MARGIN_TOP = 40;
  const MARGIN_LEFT = 80;
  const LINE_HEIGHT = 40;
  const GAP = 50;
  const SVG_WIDTH = 800;
  
  // Dynamic Height Calculation
  const getSvgHeight = () => {
      if (protocol === Protocol.SPI) return 450; // 4 lines
      if (protocol === Protocol.I2C) {
          // Check for arbitration frames to see if we need extra height
          const hasArb = frames.some(f => (f as I2CSignalFrame).sdaA !== undefined);
          return hasArb ? 450 : 360;
      }
      return 250; // UART
  };

  const SVG_HEIGHT = getSvgHeight();

  // Calculate X positions based on duration
  const timeline = useMemo(() => {
    let x = MARGIN_LEFT;
    const scale = 60; 
    return frames.map(frame => {
        const start = x;
        const width = frame.duration * scale;
        x += width;
        return { ...frame, x: start, width };
    });
  }, [frames]);

  const renderLegend = (yHigh: number, yLow: number, color: string) => (
    <g className="text-[10px] font-mono">
        <text x={MARGIN_LEFT - 16} y={yHigh + 4} fill={color} textAnchor="end" fontWeight="bold">1</text>
        <line x1={MARGIN_LEFT - 12} y1={yHigh} x2={MARGIN_LEFT - 4} y2={yHigh} stroke={color} strokeWidth="1" opacity="0.5" />
        <text x={MARGIN_LEFT - 16} y={yLow + 4} fill={color} textAnchor="end" fontWeight="bold">0</text>
        <line x1={MARGIN_LEFT - 12} y1={yLow} x2={MARGIN_LEFT - 4} y2={yLow} stroke={color} strokeWidth="1" opacity="0.5" />
    </g>
  );

  const renderTrace = (data: any[], key: string, yOffset: number, color: string, label: string) => {
      const yHigh = yOffset;
      const yLow = yOffset + LINE_HEIGHT;
      
      let d = `M ${data[0].x} ${data[0][key] === 1 ? yHigh : yLow}`;
      
      data.forEach((frame, i) => {
          const val = frame[key];
          const y = val === 1 ? yHigh : yLow;
          if (i > 0) {
              const prevVal = data[i-1][key];
              const prevY = prevVal === 1 ? yHigh : yLow;
              if (y !== prevY) {
                  d += ` L ${frame.x} ${prevY} L ${frame.x} ${y}`;
              }
          }
          d += ` L ${frame.x + frame.width} ${y}`;
      });

      return (
          <g>
              {renderLegend(yHigh, yLow, color)}
              <path d={d} fill="none" stroke={color} strokeWidth="2" />
              <text x={10} y={yLow - LINE_HEIGHT/2 + 4} fill={color} fontSize="11" fontWeight="bold">{label}</text>
          </g>
      );
  };

  // --- UART Renderer ---
  const renderUART = () => {
    const uartFrames = timeline as (SignalFrame & { x: number, width: number })[];
    return (
        <g>
            {renderTrace(uartFrames, 'level', MARGIN_TOP, '#3b82f6', 'TX Line')}
            {/* Labels */}
            {uartFrames.map((frame, i) => (
                <g key={frame.id}>
                    <line x1={frame.x} y1={10} x2={frame.x} y2={SVG_HEIGHT} stroke="#374151" strokeOpacity="0.2" />
                    <text x={frame.x + frame.width / 2} y={MARGIN_TOP + LINE_HEIGHT + 20} textAnchor="middle" fill={i === currentIndex ? "#60a5fa" : "#9ca3af"} fontSize="10">{frame.label}</text>
                    {i === currentIndex && <rect x={frame.x} y={MARGIN_TOP - 5} width={frame.width} height={LINE_HEIGHT + 10} fill="#3b82f6" fillOpacity="0.1" />}
                </g>
            ))}
        </g>
    );
  };

  // --- I2C Renderer (With Arbitration Support) ---
  const renderI2C = () => {
    const i2cFrames = timeline as (I2CSignalFrame & { x: number, width: number })[];
    const hasArb = i2cFrames.some(f => f.sdaA !== undefined);

    // Layout
    const Y_SDA_A = MARGIN_TOP;
    const Y_SDA_B = Y_SDA_A + LINE_HEIGHT + GAP;
    // If arbitration, push standard SDA/SCL down
    const Y_SDA = hasArb ? Y_SDA_B + LINE_HEIGHT + GAP : MARGIN_TOP;
    const Y_SCL = Y_SDA + LINE_HEIGHT + GAP;

    return (
        <g>
            {hasArb && (
                <>
                    {renderTrace(i2cFrames, 'sdaA', Y_SDA_A, '#60a5fa', 'DATA 1 (M_A)')}
                    {renderTrace(i2cFrames, 'sdaB', Y_SDA_B, '#a855f7', 'DATA 2 (M_B)')}
                    {/* Divider */}
                    <line x1={MARGIN_LEFT} y1={Y_SDA - GAP/2} x2={Math.max(SVG_WIDTH, timeline[timeline.length - 1]?.x + 50)} y2={Y_SDA - GAP/2} stroke="#4b5563" strokeDasharray="4" opacity="0.5"/>
                </>
            )}

            {renderTrace(i2cFrames, 'sda', Y_SDA, '#34d399', hasArb ? 'SDA (Bus)' : 'SDA')}
            {renderTrace(i2cFrames, 'scl', Y_SCL, '#fbbf24', 'SCL')}

             {/* Highlights */}
             {i2cFrames.map((frame, i) => {
                 const showLabel = frame.duration > 0.4 && frame.label !== '' && (frame.scl === 1 && (i === 0 || i2cFrames[i-1].label !== frame.label || i2cFrames[i-1].scl !== 1));
                 return (
                    <g key={frame.id}>
                        <line x1={frame.x} y1={10} x2={frame.x} y2={SVG_HEIGHT - 10} stroke="#374151" strokeOpacity="0.2" strokeDasharray="2" />
                        {i === currentIndex && <rect x={frame.x} y={10} width={frame.width} height={SVG_HEIGHT - 20} fill="#ffffff" fillOpacity="0.05" />}
                        {showLabel && <text x={frame.x + frame.width / 2} y={Y_SCL + LINE_HEIGHT + 15} textAnchor="middle" fill={i === currentIndex ? "#fff" : "#9ca3af"} fontSize="10">{frame.label}</text>}
                    </g>
                 );
             })}
        </g>
    );
  };

  // --- SPI Renderer ---
  const renderSPI = () => {
      const spiFrames = timeline as (SPISignalFrame & { x: number, width: number })[];
      
      const Y_CS = MARGIN_TOP;
      const Y_SCK = Y_CS + LINE_HEIGHT + GAP;
      const Y_MOSI = Y_SCK + LINE_HEIGHT + GAP;
      const Y_MISO = Y_MOSI + LINE_HEIGHT + GAP;

      return (
          <g>
              {renderTrace(spiFrames, 'cs', Y_CS, '#f472b6', 'CS (SS)')}
              {renderTrace(spiFrames, 'sck', Y_SCK, '#fbbf24', 'SCK')}
              {renderTrace(spiFrames, 'mosi', Y_MOSI, '#3b82f6', 'MOSI')}
              {renderTrace(spiFrames, 'miso', Y_MISO, '#a3e635', 'MISO')}

              {/* Bit Labels */}
              {spiFrames.map((frame, i) => {
                 // Show label roughly in middle of clock cycle or setup
                 return (
                    <g key={frame.id}>
                         <line x1={frame.x} y1={10} x2={frame.x} y2={SVG_HEIGHT - 10} stroke="#374151" strokeOpacity="0.2" />
                         {i === currentIndex && <rect x={frame.x} y={10} width={frame.width} height={SVG_HEIGHT - 20} fill="#ffffff" fillOpacity="0.05" />}
                         {frame.label && frame.label.startsWith('D') && i % 2 !== 0 && (
                              <text x={frame.x} y={Y_MISO + LINE_HEIGHT + 15} textAnchor="middle" fill="#9ca3af" fontSize="10">{frame.label}</text>
                         )}
                    </g>
                 );
              })}
          </g>
      );
  };

  return (
    <div className="w-full overflow-x-auto bg-gray-900 rounded-lg border border-gray-700 shadow-inner p-2">
      <svg height={SVG_HEIGHT} width={Math.max(SVG_WIDTH, timeline[timeline.length - 1]?.x + 50 || SVG_WIDTH)} className="font-mono-nums">
        {frames.length > 0 ? (
            protocol === Protocol.UART ? renderUART() : 
            protocol === Protocol.I2C ? renderI2C() :
            renderSPI()
        ) : (
            <text x="50%" y="50%" fill="#6b7280" textAnchor="middle" fontSize="14">Ready to transmit...</text>
        )}
      </svg>
    </div>
  );
};

export default SignalScope;