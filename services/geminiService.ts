import { GoogleGenAI } from "@google/genai";
import { Protocol } from '../types';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key not found in environment variables");
    }
    return new GoogleGenAI({ apiKey });
};

export const getExplanation = async (protocol: Protocol, context: string, userQuestion?: string): Promise<string> => {
    try {
        const ai = getClient();
        const modelId = 'gemini-2.5-flash'; 
        
        const systemInstruction = `You are an expert embedded systems engineer and teacher, specifically knowledgeable about the "MBR520 Embedded Systems" course.
        Your goal is to explain ${protocol} communication and conversion concepts clearly.
        
        Rules:
        1. Keep explanations short (max 2-3 sentences) unless asked for detail.
        2. Focus on the "Why" and "How" of the signal changes.
        
        Protocol Specifics:
        - **SPI**: 
           - 4-Wire Full-Duplex: MOSI, MISO, SCK, CS (Chip Select).
           - Modes defined by CPOL (Clock Polarity) and CPHA (Clock Phase).
           - Shift Register Model: Bits are shifted out of Master and Slave simultaneously.
        - **DAC (R-2R)**: "Wägeverfahren". $U_A = U_{ref} \cdot \frac{D}{2^N}$.
        - **ADC (SAR)**: 
           - Successive Approximation Register (Wägeverfahren).
           - Uses a comparator and a DAC to "weigh" bits from MSB to LSB.
           - **Quantization Error**: Difference between analog input and digital representation. $U_{LSB} = U_{ref} / 2^N$.
           - **Sampling Time**: Time required to charge the sample capacitor ($C_{sample}$).
        - **ADC (Dual Slope)**:
           - Integrating Converter. High accuracy, slow, immune to noise (averaging).
           - **Phase 1 (T1)**: Fixed time integration of Input Voltage ($U_E$). Ramp up.
           - **Phase 2 (T2)**: Variable time de-integration of Reference Voltage ($-U_{ref}$) until zero crossing. Ramp down.
           - Formula: $\frac{U_E}{U_{ref}} = \frac{T_2}{T_1}$. Result depends on ratio of times, independent of R and C values.
        - **I2C**: 
          - Open-Drain, Pull-ups. 
          - **Arbitration**: "Wired-AND" logic. If Master A sends '1' (High) but reads '0' (Low) because Master B drove '0', Master A loses arbitration immediately. It stops driving and becomes a listener. The dominant '0' wins.
        `;

        const prompt = userQuestion 
            ? `Context: ${context}\n\nUser Question: ${userQuestion}`
            : `Context: ${context}\n\nExplain what is happening in the ${protocol} simulation.`;

        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        return response.text || "I couldn't generate an explanation at this moment.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Sorry, I'm having trouble connecting to the knowledge base right now. Please check your API key or try again.";
    }
};