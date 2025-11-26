import React from 'react';
import { Protocol, I2CSignalFrame, SignalFrame, SPISignalFrame } from '../types';
import { Cpu, AlertTriangle } from 'lucide-react';

interface CanvasVisualizerProps {
  protocol: Protocol;
  currentFrame: SignalFrame | I2CSignalFrame | SPISignalFrame | null;
  isTransmitting: boolean;
  mode?: 'standard' | 'arbitration';
}

const Chip: React.FC<{ label: string; role: string; active: boolean; color: string; status?: 'normal' | 'lost' }> = ({ label, role, active, color, status = 'normal' }) => (
  <div className={`relative w-32 h-32 rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-200 shadow-lg 
    ${status === 'lost' ? 'border-red-800 bg-red-900/20 opacity-70' : active ? `border-${color}-500 bg-${color}-900/20` : 'border-gray-700 bg-gray-800'}`}>
    <Cpu className={`w-10 h-10 mb-2 ${status === 'lost' ? 'text-red-500' : active ? `text-${color}-400` : 'text-gray-500'}`} />
    <span className={`font-bold ${status === 'lost' ? 'text-red-400 line-through' : 'text-white'}`}>{label}</span>
    <span className="text-xs text-gray-400 uppercase tracking-wider">{role}</span>
    {status === 'lost' && <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center"><AlertTriangle className="w-3 h-3 mr-1" /> LOST</div>}
    {active && status !== 'lost' && <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full bg-${color}-500 animate-pulse`} />}
  </div>
);

const Wire: React.FC<{ label: string; high: boolean; color: string; vertical?: boolean }> = ({ label, high, color }) => (
  <div className="flex-1 flex flex-col items-center justify-center relative h-12">
      <span className={`text-[10px] font-mono mb-1 ${high ? `text-${color}-400` : 'text-gray-600'}`}>{label}</span>
      <div className={`w-full h-1.5 rounded transition-colors duration-100 ${high ? `bg-${color}-500 shadow-[0_0_8px_rgba(0,0,0,0.5)] shadow-${color}-500/50` : 'bg-gray-800'}`} />
  </div>
);

const CanvasVisualizer: React.FC<CanvasVisualizerProps> = ({ protocol, currentFrame, isTransmitting, mode = 'standard' }) => {
  
  // --- SPI View ---
  if (protocol === Protocol.SPI) {
      const frame = currentFrame as SPISignalFrame;
      const csActive = frame ? frame.cs === 0 : false; // Active Low
      const sckHigh = frame ? frame.sck === 1 : false;
      const mosiHigh = frame ? frame.mosi === 1 : false;
      const misoHigh = frame ? frame.miso === 1 : false;

      return (
        <div className="w-full h-72 bg-gray-950 rounded-xl border border-gray-800 p-8 flex items-center justify-between relative overflow-hidden">
            <Chip label="STM32" role="Controller" active={isTransmitting} color="blue" />
            
            <div className="flex-1 flex flex-col px-6 space-y-2">
                {/* CS */}
                <div className="flex flex-col items-center">
                    <div className={`w-full h-1 rounded ${csActive ? 'bg-pink-500 shadow-pink-500/50' : 'bg-gray-800'}`}></div>
                    <span className={`text-[9px] mt-1 ${csActive ? 'text-pink-400' : 'text-gray-600'}`}>CS (Active Low)</span>
                </div>

                {/* SCK */}
                <Wire label="SCK" high={sckHigh} color="amber" />

                {/* MOSI */}
                <div className="flex items-center w-full space-x-2">
                    <span className="text-[10px] text-gray-600">MOSI</span>
                    <div className={`flex-1 h-1.5 rounded ${mosiHigh ? 'bg-blue-500 shadow-blue-500/50' : 'bg-gray-800'}`}></div>
                    <div className="text-[10px] text-blue-500">→</div>
                </div>

                {/* MISO */}
                <div className="flex items-center w-full space-x-2">
                     <div className="text-[10px] text-green-500">←</div>
                    <div className={`flex-1 h-1.5 rounded ${misoHigh ? 'bg-lime-500 shadow-lime-500/50' : 'bg-gray-800'}`}></div>
                    <span className="text-[10px] text-gray-600">MISO</span>
                </div>
            </div>

            <Chip label="BMP280" role="Peripheral" active={csActive} color="green" />
        </div>
      );
  }

  // --- I2C View ---
  if (protocol === Protocol.I2C) {
    const frame = currentFrame as I2CSignalFrame;
    const sdaHigh = frame ? frame.sda === 1 : true;
    const sclHigh = frame ? frame.scl === 1 : true;

    // --- Arbitration Mode ---
    if (mode === 'arbitration') {
        const masterAState = frame?.masterAState || 'idle';
        const masterBState = frame?.masterBState || 'idle';
        
        return (
            <div className="w-full h-64 bg-gray-950 rounded-xl border border-gray-800 p-4 flex items-center justify-between relative overflow-hidden">
                 {/* Pull-ups (Center Top) */}
                 <div className="absolute top-2 left-1/2 -translate-x-1/2 flex space-x-4 bg-gray-900/80 p-2 rounded border border-gray-800 z-10">
                    <div className="flex flex-col items-center">
                        <div className="text-[9px] text-gray-500">R_PU</div>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                    </div>
                </div>

                {/* Left Side: Masters */}
                <div className="flex flex-col space-y-4 mr-4">
                    <Chip 
                        label="Master A" 
                        role="Addr: 0x2..." 
                        active={masterAState === 'active'} 
                        color="blue" 
                        status={masterAState === 'lost' ? 'lost' : 'normal'} 
                    />
                    <Chip 
                        label="Master B" 
                        role="Addr: 0x3..." 
                        active={masterBState === 'active'} 
                        color="purple" 
                        status={masterBState === 'lost' ? 'lost' : 'normal'} 
                    />
                </div>

                {/* Middle: Bus Lines */}
                <div className="flex-1 flex flex-col justify-center space-y-6 relative px-2">
                    <div className="absolute left-0 top-0 bottom-0 w-4 border-l-2 border-dashed border-gray-800"></div>
                    <Wire label="SDA (Data)" high={sdaHigh} color="emerald" />
                    <Wire label="SCL (Clock)" high={sclHigh} color="amber" />
                    <div className="absolute right-0 top-0 bottom-0 w-4 border-r-2 border-dashed border-gray-800"></div>
                </div>

                {/* Right Side: Slaves */}
                <div className="flex flex-col space-y-4 ml-4">
                    <Chip label="Slave 1" role="Addr: 0x20" active={false} color="gray" />
                    <Chip label="Slave 2" role="Addr: 0x30" active={false} color="gray" />
                </div>
            </div>
        );
    }

    // --- Standard I2C Mode ---
    const isAckPhase = frame?.type === 'ack';
    const masterActive = isTransmitting && !isAckPhase;
    const slaveActive = isTransmitting && isAckPhase;

    return (
      <div className="w-full h-64 bg-gray-950 rounded-xl border border-gray-800 p-8 flex items-center justify-between relative overflow-hidden">
        {/* Pull-up Resistors Visual */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex space-x-8">
            <div className="flex flex-col items-center">
                <div className="text-[10px] text-gray-500">R_PU</div>
                <div className="h-8 w-0.5 bg-gray-700"></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
            </div>
            <div className="flex flex-col items-center">
                <div className="text-[10px] text-gray-500">R_PU</div>
                <div className="h-8 w-0.5 bg-gray-700"></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
            </div>
        </div>

        <Chip label="MCU (Master)" role="Controller" active={masterActive} color="blue" />
        
        <div className="flex-1 flex flex-col px-4 space-y-4">
            <Wire label="SDA (Serial Data)" high={sdaHigh} color="emerald" />
            <Wire label="SCL (Serial Clock)" high={sclHigh} color="amber" />
        </div>

        <Chip label="Sensor (0x42)" role="Peripheral" active={slaveActive} color="green" />
      </div>
    );
  }

  // --- UART View ---
  const frame = currentFrame as SignalFrame;
  const txActive = isTransmitting;
  const rxActive = isTransmitting;
  const lineHigh = frame ? frame.level === 1 : true;

  return (
    <div className="w-full h-64 bg-gray-950 rounded-xl border border-gray-800 p-8 flex items-center justify-between relative overflow-hidden">
      <Chip label="Device A" role="Transmitter" active={txActive} color="blue" />
      
      <div className="flex-1 flex flex-col px-4 justify-center">
        <div className="relative">
            <Wire label="TX -> RX" high={lineHigh} color="blue" />
             <div className="text-center mt-2">
                <span className="text-xs text-gray-500">Baud Rate: 9600</span>
             </div>
        </div>
      </div>

      <Chip label="Device B" role="Receiver" active={rxActive} color="purple" />
    </div>
  );
};

export default CanvasVisualizer;