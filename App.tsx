import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Protocol, SignalFrame, I2CSignalFrame, SPISignalFrame, LogEntry } from './types';
import { generateUARTSequence, generateI2CSequence, generateArbitrationSequence, generateSPISequence } from './utils/protocolLogic';
import { getExplanation } from './services/geminiService';
import SignalScope from './components/SignalScope';
import CanvasVisualizer from './components/CanvasVisualizer';
import { ProtocolPhaseBar } from './components/ProtocolPhaseBar';
import DACVisualizer from './components/DACVisualizer';
import ADCVisualizer from './components/ADCVisualizer';
import { Play, RotateCcw, MessageSquare, Send, Activity, Zap, Info, Users, GitMerge, FileDigit, Search, TrendingUp } from 'lucide-react';

const INITIAL_UART_CHAR = 'K';
const INITIAL_I2C_ADDR = 0x42;
const INITIAL_I2C_DATA = 0x15;

const App: React.FC = () => {
  const [protocol, setProtocol] = useState<Protocol>(Protocol.UART);
  const [frames, setFrames] = useState<(SignalFrame | I2CSignalFrame | SPISignalFrame)[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Inputs
  const [uartInput, setUartInput] = useState(INITIAL_UART_CHAR);
  const [i2cAddr, setI2cAddr] = useState(INITIAL_I2C_ADDR.toString(16));
  const [i2cData, setI2cData] = useState(INITIAL_I2C_DATA.toString(16));
  
  // I2C Advanced Modes
  const [i2cMode, setI2cMode] = useState<'standard' | 'arbitration'>('standard');
  const [arbAddrA, setArbAddrA] = useState('21'); // Master A target
  const [arbAddrB, setArbAddrB] = useState('25'); // Master B target

  // SPI Inputs
  const [spiDataTx, setSpiDataTx] = useState('F0');
  const [spiDataRx, setSpiDataRx] = useState('0F'); // MISO Data
  const [spiMode, setSpiMode] = useState(0); // 0, 1, 2, 3

  // DAC State
  const [dacValue, setDacValue] = useState(8); 
  const dacVRef = 3.3;

  // ADC State
  const [adcMode, setAdcMode] = useState<'sar' | 'dual-slope'>('sar');
  
  // AI
  const [aiThinking, setAiThinking] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  const addLog = (source: LogEntry['source'], message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{
        id: Math.random().toString(36).substring(7),
        timestamp: new Date(),
        source,
        message,
        type
    }, ...prev.slice(0, 9)]); 
  };

  // --- Simulation Control ---

  const resetSimulation = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
    setCurrentIndex(-1);
    setFrames([]);
    setAiResponse(null);
  }, []);

  const prepareSimulation = () => {
    resetSimulation();
    let newFrames: (SignalFrame | I2CSignalFrame | SPISignalFrame)[] = [];

    if (protocol === Protocol.UART) {
        if (!uartInput) return;
        newFrames = generateUARTSequence(uartInput.substring(0, 1)); 
        addLog('System', `Prepared UART sequence for char '${uartInput[0]}'`);
    } else if (protocol === Protocol.I2C) {
        if (i2cMode === 'arbitration') {
            const addrA = parseInt(arbAddrA, 16) || 0x21;
            const addrB = parseInt(arbAddrB, 16) || 0x25;
            newFrames = generateArbitrationSequence(addrA, addrB);
            addLog('System', `Prepared Multi-Master Arbitration: A(0x${addrA.toString(16)}) vs B(0x${addrB.toString(16)})`);
        } else {
            const addr = parseInt(i2cAddr, 16) || INITIAL_I2C_ADDR;
            const data = parseInt(i2cData, 16) || INITIAL_I2C_DATA;
            newFrames = generateI2CSequence(addr, data);
            addLog('System', `Prepared I2C write to 0x${addr.toString(16)}`);
        }
    } else if (protocol === Protocol.SPI) {
        const tx = parseInt(spiDataTx, 16) || 0xF0;
        const rx = parseInt(spiDataRx, 16) || 0x0F;
        newFrames = generateSPISequence(tx, rx, spiMode);
        addLog('System', `Prepared SPI Mode ${spiMode}: TX=0x${tx.toString(16)} RX=0x${rx.toString(16)}`);
    }
    setFrames(newFrames);
    return newFrames;
  };

  const startSimulation = () => {
    if (protocol === Protocol.DAC || protocol === Protocol.ADC) return; 
    const readyFrames = frames.length > 0 ? frames : prepareSimulation();
    if (!readyFrames || readyFrames.length === 0) return;

    setIsPlaying(true);
    setCurrentIndex(0);
  };

  useEffect(() => {
    if (isPlaying && currentIndex >= 0 && currentIndex < frames.length) {
      const currentDuration = frames[currentIndex].duration * 800; 
      
      timerRef.current = window.setTimeout(() => {
        if (currentIndex < frames.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
          if (protocol === Protocol.I2C && i2cMode === 'arbitration') {
              const arbFrame = frames[frames.length - 3] as I2CSignalFrame; // Check near end
              if (arbFrame && arbFrame.masterAState === 'lost') addLog('System', 'Master A Lost Arbitration', 'error');
              else if (arbFrame && arbFrame.masterBState === 'lost') addLog('System', 'Master B Lost Arbitration', 'error');
              else addLog('System', 'Arbitration Complete', 'success');
          } else {
             addLog('System', 'Transmission Complete', 'success');
          }
        }
      }, currentDuration);
    }
    return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentIndex, frames, i2cMode, protocol]);


  // --- AI Integration ---
  const askAI = async (customQuestion?: string) => {
    setAiThinking(true);
    setAiResponse(null);
    
    // Construct context description
    let context = "";
    if (protocol === Protocol.SPI) {
        context = `SPI Mode ${spiMode} transmission. 
        CPOL=${(spiMode & 2) ? 1 : 0}, CPHA=${(spiMode & 1) ? 1 : 0}.
        Master sending 0x${spiDataTx}, Slave sending 0x${spiDataRx}.
        Full-duplex 4-wire configuration.`;
    } else if (protocol === Protocol.UART) {
        const charCode = uartInput.charCodeAt(0);
        context = `UART Transmission of character '${uartInput}' (ASCII ${charCode}). Protocol: 8N1.`;
    } else if (protocol === Protocol.I2C) {
        if (i2cMode === 'arbitration') {
            const addrA = parseInt(arbAddrA, 16);
            const addrB = parseInt(arbAddrB, 16);
            context = `I2C Multi-Master Arbitration Simulation. 
            Master A sends 0x${addrA.toString(16)}. Master B sends 0x${addrB.toString(16)}.
            Explain Wired-AND logic and who wins.`;
        } else {
            context = `I2C Write to 0x${i2cAddr}. Data: 0x${i2cData}.`;
        }
    } else if (protocol === Protocol.DAC) {
        context = `DAC (R-2R Ladder). Input: ${dacValue}.`;
    } else if (protocol === Protocol.ADC) {
        if (adcMode === 'sar') {
            context = `ADC (SAR Method). Resolution: 4-bit. Explaining Successive Approximation and Quantization.`;
        } else {
            context = `ADC (Dual Slope Method). Explaining Integration Phase (T1) and De-integration Phase (T2). T2/T1 = Ue/Uref. Independence from RC.`;
        }
    }

    const response = await getExplanation(protocol, context, customQuestion);
    setAiResponse(response);
    setAiThinking(false);
    addLog('AI', 'Explanation generated', 'ai');
  };

  const handleProtocolSwitch = (p: Protocol) => {
    setProtocol(p);
    resetSimulation();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 p-4 shadow-md z-10">
            <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center space-x-3">
                    <Activity className="text-blue-500 w-6 h-6" />
                    <h1 className="text-xl font-bold tracking-tight">ProtoSim <span className="text-gray-500 font-normal text-sm ml-2 hidden sm:inline">Signal Explorer</span></h1>
                </div>
                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700 overflow-x-auto">
                    <button onClick={() => handleProtocolSwitch(Protocol.UART)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${protocol === Protocol.UART ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>UART</button>
                    <button onClick={() => handleProtocolSwitch(Protocol.I2C)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${protocol === Protocol.I2C ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>I2C</button>
                    <button onClick={() => handleProtocolSwitch(Protocol.SPI)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${protocol === Protocol.SPI ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>SPI</button>
                    <div className="w-px h-6 bg-gray-700 mx-2"></div>
                    <button onClick={() => handleProtocolSwitch(Protocol.DAC)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${protocol === Protocol.DAC ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>DAC</button>
                    <button onClick={() => handleProtocolSwitch(Protocol.ADC)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${protocol === Protocol.ADC ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>ADC</button>
                </div>
            </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-6">
                {protocol === Protocol.DAC ? (
                    <div className="h-full">
                         <div className="flex justify-between items-center mb-3">
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">DAC Explorer</h2>
                        </div>
                        <DACVisualizer resolution={4} vRef={dacVRef} value={dacValue} onChange={setDacValue} />
                    </div>
                ) : protocol === Protocol.ADC ? (
                    <div className="h-full">
                         <div className="flex justify-between items-center mb-3">
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">ADC Explorer</h2>
                            <div className="flex bg-gray-800 rounded-md p-0.5 border border-gray-700">
                                <button onClick={() => setAdcMode('sar')} className={`px-3 py-1 text-xs rounded font-medium flex items-center space-x-1 ${adcMode === 'sar' ? 'bg-cyan-700 text-white' : 'text-gray-400'}`}>
                                    <Search className="w-3 h-3" /><span>SAR</span>
                                </button>
                                <button onClick={() => setAdcMode('dual-slope')} className={`px-3 py-1 text-xs rounded font-medium flex items-center space-x-1 ${adcMode === 'dual-slope' ? 'bg-pink-700 text-white' : 'text-gray-400'}`}>
                                    <TrendingUp className="w-3 h-3" /><span>Dual Slope</span>
                                </button>
                            </div>
                        </div>
                        <ADCVisualizer resolution={4} vRef={dacVRef} mode={adcMode} />
                    </div>
                ) : (
                    <>
                        <section>
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center space-x-4">
                                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{protocol} Visualization</h2>
                                    {protocol === Protocol.I2C && (
                                        <div className="flex bg-gray-800 rounded-md p-0.5 border border-gray-700">
                                            <button onClick={() => { setI2cMode('standard'); resetSimulation(); }} className={`px-2 py-0.5 text-xs rounded ${i2cMode === 'standard' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>Std</button>
                                            <button onClick={() => { setI2cMode('arbitration'); resetSimulation(); }} className={`px-2 py-0.5 text-xs rounded flex items-center space-x-1 ${i2cMode === 'arbitration' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
                                                <GitMerge className="w-3 h-3" /><span>Arb</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="bg-gray-950 rounded-t-xl border-x border-t border-gray-800 overflow-hidden">
                                <CanvasVisualizer protocol={protocol} currentFrame={currentIndex >= 0 ? frames[currentIndex] : null} isTransmitting={isPlaying} mode={protocol === Protocol.I2C ? i2cMode : undefined} />
                            </div>
                            {protocol === Protocol.I2C && <ProtocolPhaseBar protocol={protocol} frames={frames} currentIndex={currentIndex} />}
                            {(protocol === Protocol.UART || protocol === Protocol.SPI) && <div className="h-4 bg-gray-900 rounded-b-xl border-x border-b border-gray-800 mb-6"></div>}
                        </section>

                        <section>
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Logic Analyzer</h2>
                            <SignalScope protocol={protocol} frames={frames} currentIndex={currentIndex} />
                        </section>

                        <section className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-lg">
                            <div className="flex flex-wrap gap-6 items-end">
                                {protocol === Protocol.UART && (
                                    <div className="flex flex-col space-y-1.5">
                                        <label className="text-xs text-gray-400 font-medium ml-1">Char</label>
                                        <input type="text" maxLength={1} value={uartInput} onChange={(e) => { setUartInput(e.target.value); resetSimulation(); }} className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 w-20 text-center font-mono focus:outline-none" />
                                    </div>
                                )}
                                {protocol === Protocol.SPI && (
                                    <>
                                        <div className="flex flex-col space-y-1.5">
                                            <label className="text-xs text-gray-400 font-medium ml-1">Mode (0-3)</label>
                                            <select value={spiMode} onChange={(e) => { setSpiMode(Number(e.target.value)); resetSimulation(); }} className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 w-24 font-mono focus:outline-none">
                                                <option value="0">0 (0,0)</option>
                                                <option value="1">1 (0,1)</option>
                                                <option value="2">2 (1,0)</option>
                                                <option value="3">3 (1,1)</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <label className="text-xs text-gray-400 font-medium ml-1">MOSI (Hex)</label>
                                            <input type="text" maxLength={2} value={spiDataTx} onChange={(e) => { setSpiDataTx(e.target.value); resetSimulation(); }} className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 w-20 text-center font-mono focus:outline-none" />
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <label className="text-xs text-gray-400 font-medium ml-1">MISO (Hex)</label>
                                            <input type="text" maxLength={2} value={spiDataRx} onChange={(e) => { setSpiDataRx(e.target.value); resetSimulation(); }} className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 w-20 text-center font-mono focus:outline-none" />
                                        </div>
                                    </>
                                )}
                                {protocol === Protocol.I2C && i2cMode === 'standard' && (
                                    <>
                                         <div className="flex flex-col space-y-1.5">
                                            <label className="text-xs text-gray-400 font-medium ml-1">Addr</label>
                                            <input type="text" maxLength={2} value={i2cAddr} onChange={(e) => { setI2cAddr(e.target.value); resetSimulation(); }} className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 w-20 text-center font-mono" />
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <label className="text-xs text-gray-400 font-medium ml-1">Data</label>
                                            <input type="text" maxLength={2} value={i2cData} onChange={(e) => { setI2cData(e.target.value); resetSimulation(); }} className="bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 w-20 text-center font-mono" />
                                        </div>
                                    </>
                                )}
                                {protocol === Protocol.I2C && i2cMode === 'arbitration' && (
                                    <>
                                        <div className="flex flex-col space-y-1.5">
                                            <label className="text-xs text-blue-400 font-medium ml-1">Master A Addr</label>
                                            <input type="text" maxLength={2} value={arbAddrA} onChange={(e) => { setArbAddrA(e.target.value); resetSimulation(); }} className="bg-gray-900 border border-blue-900/50 text-white rounded px-3 py-2 w-28 text-center font-mono" />
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <label className="text-xs text-purple-400 font-medium ml-1">Master B Addr</label>
                                            <input type="text" maxLength={2} value={arbAddrB} onChange={(e) => { setArbAddrB(e.target.value); resetSimulation(); }} className="bg-gray-900 border border-purple-900/50 text-white rounded px-3 py-2 w-28 text-center font-mono" />
                                        </div>
                                    </>
                                )}

                                <div className="flex space-x-3 ml-auto">
                                    <button onClick={resetSimulation} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"><RotateCcw className="w-5 h-5" /></button>
                                    <button onClick={startSimulation} disabled={isPlaying} className="flex items-center space-x-2 px-6 py-2 rounded-lg font-bold shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50">
                                        <Play className="w-4 h-4 fill-current" /><span>Start</span>
                                    </button>
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </div>

            {/* Right Column: AI */}
            <div className="lg:col-span-4 flex flex-col h-full bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
                <div className="bg-gray-900/50 p-4 border-b border-gray-700 flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-white">AI Tutor</h3>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-[300px]">
                    {!aiResponse && !aiThinking && (
                         <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => askAI("Explain this protocol.")} className="text-left text-xs p-3 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"><Zap className="w-3 h-3 inline mr-2 text-yellow-400"/>Explain Protocol</button>
                            {protocol === Protocol.I2C && i2cMode === 'arbitration' && <button onClick={() => askAI("How does I2C Arbitration work?")} className="text-left text-xs p-3 rounded bg-purple-900/20 hover:bg-purple-900/30 text-purple-300 border border-purple-800"><GitMerge className="w-3 h-3 inline mr-2"/>Explain Arbitration</button>}
                            {protocol === Protocol.SPI && <button onClick={() => askAI("Explain SPI Modes (CPOL/CPHA).")} className="text-left text-xs p-3 rounded bg-pink-900/20 hover:bg-pink-900/30 text-pink-300 border border-pink-800"><FileDigit className="w-3 h-3 inline mr-2"/>Explain Modes</button>}
                            {protocol === Protocol.ADC && <button onClick={() => askAI("How does SAR ADC work?")} className="text-left text-xs p-3 rounded bg-cyan-900/20 hover:bg-cyan-900/30 text-cyan-300 border border-cyan-800"><Search className="w-3 h-3 inline mr-2"/>Explain SAR</button>}
                            {protocol === Protocol.ADC && <button onClick={() => askAI("How does Dual Slope ADC work?")} className="text-left text-xs p-3 rounded bg-pink-900/20 hover:bg-pink-900/30 text-pink-300 border border-pink-800"><TrendingUp className="w-3 h-3 inline mr-2"/>Explain Dual Slope</button>}
                         </div>
                    )}
                    {aiThinking && <div className="text-purple-300 animate-pulse text-sm">Analyzing...</div>}
                    {aiResponse && <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 text-sm text-purple-100 leading-relaxed whitespace-pre-wrap">{aiResponse}</div>}
                </div>
                <div className="p-4 bg-gray-900 border-t border-gray-700 relative">
                     <input type="text" placeholder="Ask..." className="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded-lg pl-4 pr-10 py-2.5 focus:outline-none" onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value) { askAI(e.currentTarget.value); e.currentTarget.value = ''; }}} />
                </div>
            </div>
        </main>
    </div>
  );
};

export default App;