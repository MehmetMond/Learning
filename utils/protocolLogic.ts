import { SignalFrame, I2CSignalFrame, SPISignalFrame } from '../types';

// --- UART Logic ---
export const generateUARTSequence = (char: string): SignalFrame[] => {
  if (char.length === 0) return [];
  
  const ascii = char.charCodeAt(0);
  const frames: SignalFrame[] = [];
  let idCounter = 0;

  // Idle state (High)
  frames.push({ id: idCounter++, label: 'Idle', level: 1, type: 'idle', duration: 1 });

  // Start Bit (Low)
  frames.push({ id: idCounter++, label: 'Start', level: 0, type: 'start', duration: 1 });

  // Data Bits (LSB First) - 8 bits
  for (let i = 0; i < 8; i++) {
    const bit = (ascii >> i) & 1;
    frames.push({ 
      id: idCounter++, 
      label: `D${i}`, 
      level: bit as 0 | 1, 
      type: 'data', 
      duration: 1 
    });
  }

  // Stop Bit (High)
  frames.push({ id: idCounter++, label: 'Stop', level: 1, type: 'stop', duration: 1 });

  // Return to Idle
  frames.push({ id: idCounter++, label: 'Idle', level: 1, type: 'idle', duration: 1 });

  return frames;
};

// --- I2C Logic ---
export const generateI2CSequence = (address: number, data: number): I2CSignalFrame[] => {
    const frames: I2CSignalFrame[] = [];
    let idCounter = 0;

    // Idle: SDA High, SCL High
    frames.push({ id: idCounter++, label: 'Idle', sda: 1, scl: 1, type: 'idle', duration: 1 });

    // Start Condition: SDA goes Low while SCL is High
    frames.push({ id: idCounter++, label: 'Start', sda: 0, scl: 1, type: 'start', duration: 1 });
    // Prepare for data (SCL goes low)
    frames.push({ id: idCounter++, label: '', sda: 0, scl: 0, type: 'start', duration: 0.5 });

    // Address (7 bits, MSB first)
    for (let i = 6; i >= 0; i--) {
        const bit = (address >> i) & 1;
        // Set Data
        frames.push({ id: idCounter++, label: `A${i}`, sda: bit as 0 | 1, scl: 0, type: 'address', duration: 0.5 });
        // Clock Pulse
        frames.push({ id: idCounter++, label: `A${i}`, sda: bit as 0 | 1, scl: 1, type: 'address', duration: 0.5 });
        frames.push({ id: idCounter++, label: `A${i}`, sda: bit as 0 | 1, scl: 0, type: 'address', duration: 0.5 });
    }

    // Read/Write Bit (Write = 0)
    frames.push({ id: idCounter++, label: 'W', sda: 0, scl: 0, type: 'address', duration: 0.5 });
    frames.push({ id: idCounter++, label: 'W', sda: 0, scl: 1, type: 'address', duration: 0.5 });
    frames.push({ id: idCounter++, label: 'W', sda: 0, scl: 0, type: 'address', duration: 0.5 });

    // ACK (Slave pulls Low) - Simulated successful ACK
    frames.push({ id: idCounter++, label: 'ACK', sda: 0, scl: 0, type: 'ack', duration: 0.5 });
    frames.push({ id: idCounter++, label: 'ACK', sda: 0, scl: 1, type: 'ack', duration: 0.5 });
    frames.push({ id: idCounter++, label: 'ACK', sda: 0, scl: 0, type: 'ack', duration: 0.5 });

    // Data Byte (MSB First)
    for (let i = 7; i >= 0; i--) {
        const bit = (data >> i) & 1;
        frames.push({ id: idCounter++, label: `D${i}`, sda: bit as 0 | 1, scl: 0, type: 'data', duration: 0.5 });
        frames.push({ id: idCounter++, label: `D${i}`, sda: bit as 0 | 1, scl: 1, type: 'data', duration: 0.5 });
        frames.push({ id: idCounter++, label: `D${i}`, sda: bit as 0 | 1, scl: 0, type: 'data', duration: 0.5 });
    }

    // ACK for Data
    frames.push({ id: idCounter++, label: 'ACK', sda: 0, scl: 0, type: 'ack', duration: 0.5 });
    frames.push({ id: idCounter++, label: 'ACK', sda: 0, scl: 1, type: 'ack', duration: 0.5 });
    frames.push({ id: idCounter++, label: 'ACK', sda: 0, scl: 0, type: 'ack', duration: 0.5 });

    // Stop Condition: SDA Low -> High while SCL High
    frames.push({ id: idCounter++, label: 'Stop', sda: 0, scl: 0, type: 'stop', duration: 0.5 });
    frames.push({ id: idCounter++, label: 'Stop', sda: 0, scl: 1, type: 'stop', duration: 0.5 });
    frames.push({ id: idCounter++, label: 'Stop', sda: 1, scl: 1, type: 'stop', duration: 1 });

    return frames;
};

// --- I2C Arbitration Logic ---
export const generateArbitrationSequence = (addrA: number, addrB: number): I2CSignalFrame[] => {
    const frames: I2CSignalFrame[] = [];
    let idCounter = 0;
    let masterALost = false;
    let masterBLost = false;

    // Helper to add frame with current master states
    const addFrame = (label: string, sdaA: 0|1, sdaB: 0|1, scl: 0 | 1, type: I2CSignalFrame['type'], duration: number) => {
        // Wired-AND Logic: Bus is 0 if ANY master drives 0.
        // If a master has lost, it releases the bus (drives 1).
        const effectiveA = masterALost ? 1 : sdaA;
        const effectiveB = masterBLost ? 1 : sdaB;
        const busSda = (effectiveA === 0 || effectiveB === 0) ? 0 : 1;

        frames.push({
            id: idCounter++,
            label,
            sda: busSda,
            scl,
            type,
            duration,
            sdaA: effectiveA,
            sdaB: effectiveB,
            masterAState: masterALost ? 'lost' : 'active',
            masterBState: masterBLost ? 'lost' : 'active',
        });
    };

    // 1. Idle
    addFrame('Idle', 1, 1, 1, 'idle', 1);

    // 2. Start Condition (Both Masters pull Low)
    addFrame('Start', 0, 0, 1, 'start', 1);
    addFrame('', 0, 0, 0, 'start', 0.5); // Prep for first bit

    // 3. Arbitration Phase (Address Bits)
    for (let i = 6; i >= 0; i--) {
        const bitA = (addrA >> i) & 1;
        const bitB = (addrB >> i) & 1;
        
        const valA = bitA as 0 | 1;
        const valB = bitB as 0 | 1;
        
        // Check for arbitration loss BEFORE the clock pulse effectively
        // But practically it happens during the bit time.
        // Current bus state logic handles the Wired-AND.
        
        // Determine if anyone loses during this bit
        if (!masterALost && !masterBLost) {
            if (valA === 1 && valB === 0) {
                // A wants High, B drives Low -> Bus is Low. A reads Low -> A Loses.
                masterALost = true;
            } else if (valA === 0 && valB === 1) {
                // A drives Low, B wants High -> Bus is Low. B reads Low -> B Loses.
                masterBLost = true;
            }
        }
        // If one was already lost, they output 1 (passive)

        const label = `A${i}`;

        // Clock Low (Set Data)
        addFrame(label, valA, valB, 0, 'address', 0.5);
        // Clock High (Read Data & Check Arbitration)
        addFrame(label, valA, valB, 1, 'address', 0.5);
        // Clock Low (Hold)
        addFrame(label, valA, valB, 0, 'address', 0.5);
    }

    // 4. Write Bit
    const rwA = 0; 
    const rwB = 0; 
    addFrame('W', rwA, rwB, 0, 'address', 0.5);
    addFrame('W', rwA, rwB, 1, 'address', 0.5);
    addFrame('W', rwA, rwB, 0, 'address', 0.5);

    // 5. ACK (Slave drives this)
    // Simplified: Both masters release bus to read ACK (so they drive 1)
    // Slave pulls SDA low.
    frames.push({
        id: idCounter++, label: 'ACK', sda: 0, scl: 0, type: 'ack', duration: 0.5,
        sdaA: 1, sdaB: 1, masterAState: masterALost ? 'lost' : 'active', masterBState: masterBLost ? 'lost' : 'active'
    });
    frames.push({
        id: idCounter++, label: 'ACK', sda: 0, scl: 1, type: 'ack', duration: 0.5,
        sdaA: 1, sdaB: 1, masterAState: masterALost ? 'lost' : 'active', masterBState: masterBLost ? 'lost' : 'active'
    });
    frames.push({
        id: idCounter++, label: 'ACK', sda: 0, scl: 0, type: 'ack', duration: 0.5,
        sdaA: 1, sdaB: 1, masterAState: masterALost ? 'lost' : 'active', masterBState: masterBLost ? 'lost' : 'active'
    });

    // 6. Stop 
    addFrame('Stop', 0, 0, 0, 'stop', 0.5);
    addFrame('Stop', 0, 0, 1, 'stop', 0.5);
    addFrame('Stop', 1, 1, 1, 'stop', 1);

    return frames;
};

// --- SPI Logic ---
export const generateSPISequence = (dataTx: number, dataRx: number, mode: number): SPISignalFrame[] => {
    const frames: SPISignalFrame[] = [];
    let idCounter = 0;

    // Decode Mode
    const cpol = (mode & 2) ? 1 : 0; // Clock Polarity (0: Idle Low, 1: Idle High)
    const cpha = (mode & 1) ? 1 : 0; // Clock Phase (0: Sample 1st edge, 1: Sample 2nd edge)

    const idleSCK = cpol as 0 | 1;
    const activeSCK = (1 - cpol) as 0 | 1;

    // Helper to add frame
    const addFrame = (label: string, cs: 0|1, sck: 0|1, mosi: 0|1, miso: 0|1, type: SPISignalFrame['type'], duration: number) => {
        frames.push({ id: idCounter++, label, cs, sck, mosi, miso, type, duration });
    };

    // 1. Idle State
    addFrame('Idle', 1, idleSCK, 1, 1, 'idle', 1);

    // 2. CS Active (Low) - Setup time
    addFrame('CS Low', 0, idleSCK, 1, 1, 'setup', 0.5);

    // 3. Data Transfer (8 bits, MSB First)
    for (let i = 7; i >= 0; i--) {
        const bitTx = (dataTx >> i) & 1;
        const bitRx = (dataRx >> i) & 1;
        const valTx = bitTx as 0 | 1;
        const valRx = bitRx as 0 | 1;

        // CPHA = 0: Data setup on trailing edge of previous cycle (or CS fall), Sample on 1st edge
        // CPHA = 1: Data setup on 1st edge, Sample on 2nd edge

        if (cpha === 0) {
            // -- CPHA 0 --
            // Phase 1: Setup Data (Before clock edge)
            addFrame(`D${i}`, 0, idleSCK, valTx, valRx, 'data', 0.5);
            // Phase 2: First Clock Edge (Sample)
            addFrame(`D${i}`, 0, activeSCK, valTx, valRx, 'data', 0.5);
        } else {
            // -- CPHA 1 --
            // Phase 1: First Clock Edge (Setup Data)
            addFrame(`D${i}`, 0, activeSCK, valTx, valRx, 'data', 0.5);
            // Phase 2: Second Clock Edge (Sample)
            addFrame(`D${i}`, 0, idleSCK, valTx, valRx, 'data', 0.5);
        }
    }

    // 4. Trailing time / Return to idle
    if (cpha === 0) {
        // Return clock to idle
        addFrame('', 0, idleSCK, 1, 1, 'idle', 0.5);
    }

    // 5. CS Inactive (High)
    addFrame('CS High', 1, idleSCK, 1, 1, 'idle', 1);

    return frames;
}