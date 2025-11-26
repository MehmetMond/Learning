import React from 'react';
import { Protocol, SignalFrame, I2CSignalFrame, SPISignalFrame } from '../types';

interface ProtocolPhaseBarProps {
    protocol: Protocol;
    frames: (SignalFrame | I2CSignalFrame | SPISignalFrame)[];
    currentIndex: number;
}

export const ProtocolPhaseBar: React.FC<ProtocolPhaseBarProps> = ({ protocol, frames, currentIndex }) => {
    if (protocol !== Protocol.I2C) return null;

    const currentFrame = currentIndex >= 0 ? frames[currentIndex] as I2CSignalFrame : null;
    
    // Heuristic to determine phase index
    // Phases: Start(0), Address(1), R/W(2), Ack(3), Data(4), Ack(5), Stop(6)
    let activePhaseIndex = -1;

    if (currentFrame) {
        const type = currentFrame.type;
        const label = currentFrame.label;
        
        // Find index of first data frame to distinguish ACKs
        const firstDataIndex = frames.findIndex(f => f.type === 'data');
        
        if (type === 'start') activePhaseIndex = 0;
        else if (type === 'address') {
            if (label === 'W' || label === 'R') activePhaseIndex = 2;
            else activePhaseIndex = 1;
        }
        else if (type === 'ack') {
            // If we haven't reached data yet (or there is no data), it's the first ACK (Addr Ack)
            if (firstDataIndex === -1 || currentIndex < firstDataIndex) {
                activePhaseIndex = 3;
            } else {
                activePhaseIndex = 5;
            }
        }
        else if (type === 'data') activePhaseIndex = 4;
        else if (type === 'stop') activePhaseIndex = 6;
    }

    const phases = [
        { label: 'Start', color: 'text-emerald-400', borderColor: 'border-emerald-500/50' },
        { label: 'Address', color: 'text-blue-400', borderColor: 'border-blue-500/50' },
        { label: 'R/W', color: 'text-purple-400', borderColor: 'border-purple-500/50' },
        { label: 'Ack', color: 'text-amber-400', borderColor: 'border-amber-500/50' },
        { label: 'Data', color: 'text-cyan-400', borderColor: 'border-cyan-500/50' },
        { label: 'Ack', color: 'text-amber-400', borderColor: 'border-amber-500/50' },
        { label: 'Stop', color: 'text-red-400', borderColor: 'border-red-500/50' }
    ];

    return (
        <div className="w-full bg-gray-900 border-x border-b border-gray-800 rounded-b-xl p-4 flex justify-between items-center overflow-x-auto mb-6">
            {phases.map((phase, idx) => {
                const isActive = idx === activePhaseIndex;
                return (
                    <div key={idx} className="flex items-center flex-1 justify-center min-w-[60px]">
                        <div 
                            className={`
                                px-3 py-1.5 rounded-md border text-xs font-bold uppercase tracking-wider transition-all duration-200
                                ${isActive 
                                    ? `bg-gray-800 ${phase.borderColor} ${phase.color} shadow-[0_0_15px_rgba(0,0,0,0.3)] scale-110 ring-1 ring-white/10` 
                                    : 'border-transparent text-gray-700 scale-95'
                                }
                            `}
                        >
                            {phase.label}
                        </div>
                        {idx < phases.length - 1 && (
                            <div className={`h-0.5 w-full mx-2 rounded transition-colors duration-300 ${isActive ? 'bg-gray-700' : 'bg-gray-800'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};