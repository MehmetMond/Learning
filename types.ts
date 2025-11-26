export enum Protocol {
    UART = 'UART',
    I2C = 'I2C',
    SPI = 'SPI',
    DAC = 'DAC',
    ADC = 'ADC'
  }
  
  export interface SignalFrame {
    id: number;
    label: string;
    level: 0 | 1; // Logic level
    type: 'start' | 'stop' | 'data' | 'parity' | 'idle' | 'ack' | 'nack' | 'address' | 'rw';
    duration: number; // standardized duration units
  }
  
  export interface I2CSignalFrame {
    id: number;
    label: string;
    sda: 0 | 1;
    scl: 0 | 1;
    type: 'start' | 'stop' | 'data' | 'ack' | 'nack' | 'idle' | 'address';
    duration: number;
    // Optional fields for Arbitration visualization
    sdaA?: 0 | 1; // Internal SDA of Master A
    sdaB?: 0 | 1; // Internal SDA of Master B
    masterAState?: 'active' | 'lost' | 'idle';
    masterBState?: 'active' | 'lost' | 'idle';
  }

  export interface SPISignalFrame {
    id: number;
    label: string;
    cs: 0 | 1;
    sck: 0 | 1;
    mosi: 0 | 1;
    miso: 0 | 1;
    type: 'idle' | 'data' | 'setup' | 'sample';
    duration: number;
  }
  
  export interface SimulationState {
    isPlaying: boolean;
    progress: number; // 0 to 100% of the current transmission
    currentFrameIndex: number;
    frames: SignalFrame[] | I2CSignalFrame[] | SPISignalFrame[];
  }
  
  export interface LogEntry {
    id: string;
    timestamp: Date;
    source: 'System' | 'Master' | 'Slave' | 'AI';
    message: string;
    type: 'info' | 'success' | 'error' | 'ai';
  }
  
  export interface AIExplanationRequest {
    protocol: Protocol;
    context: string;
    question?: string;
  }