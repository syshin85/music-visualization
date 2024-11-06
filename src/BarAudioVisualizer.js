import React, { useEffect, useRef, useState } from 'react';

const AudioVisualizer = () => {
    const canvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const audioElementRef = useRef(null);
    const audiogramRef = useRef({
        125: 0, 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0
    });
    const [audioFile, setAudioFile] = useState(null);

    const [audiogram, setAudiogram] = useState({
        125: 0, 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0
    });

    // Predefined audiogram profiles
    const normalHearingProfile = {
        125: 0, 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0, 8000: 0
    };

    const ageRelatedHearingLossProfile = {
      125: 10, 250: 15, 500: 20, 1000: 25, 2000: 35, 4000: 55, 8000: 70
  };

    const ciAudiogramProfile = {
        125: 90, 250: 75, 500: 60, 1000: 35, 2000: 30, 4000: 35, 8000: 70
    };

    const deafAudiogramProfile = {
      125: 70, 250: 80, 500: 90, 1000: 90, 2000: 95, 4000: 100, 8000: 100
    };

    useEffect(() => {
        if (audioFile) {
            const initAudio = () => {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                
                const source = audioContextRef.current.createMediaElementSource(audioElementRef.current);
                source.connect(analyserRef.current);
                analyserRef.current.connect(audioContextRef.current.destination);
                analyserRef.current.fftSize = 512;
                
                draw();
            };

            initAudio();

            return () => {
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
            };
        }
    }, [audioFile]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const fileURL = URL.createObjectURL(file);
            setAudioFile(fileURL);
        }
    };

    const handleAudiogramChange = (frequency, value) => {
        const newValue = parseInt(value);
        setAudiogram(prev => ({ ...prev, [frequency]: newValue }));
        audiogramRef.current[frequency] = newValue;
    };

    // Set predefined profiles
    const applyPreset = (profile) => {
        setAudiogram(profile);
        audiogramRef.current = { ...profile }; // Update ref for real-time visualization
    };

    const interpolateAudiogram = (frequency) => {
        const freqs = Object.keys(audiogramRef.current).map(Number).sort((a, b) => a - b);
        
        for (let i = 0; i < freqs.length - 1; i++) {
            const f1 = freqs[i];
            const f2 = freqs[i + 1];
            if (frequency >= f1 && frequency <= f2) {
                const val1 = audiogramRef.current[f1];
                const val2 = audiogramRef.current[f2];
                const t = (frequency - f1) / (f2 - f1);
                return val1 * (1 - t) + val2 * t;
            }
        }
        return frequency <= freqs[0]
            ? audiogramRef.current[freqs[0]]
            : audiogramRef.current[freqs[freqs.length - 1]];
    };

    const applyAudiogramCompression = (frequency, amplitude) => {
        const adjustmentDb = interpolateAudiogram(frequency);
        
        // Define thresholds for normal and profound hearing loss
        const normalThreshold = 0;
        const profoundThreshold = 100;

        // Calculate the effective reduction factor
        let reductionFactor;
        if (adjustmentDb <= normalThreshold) {
            reductionFactor = 1; // No reduction for normal hearing
        } else if (adjustmentDb >= profoundThreshold) {
            reductionFactor = 0; // Completely inaudible at profound loss
        } else {
            // Interpolate reduction factor between normal and profound thresholds
            reductionFactor = 1 - (adjustmentDb - normalThreshold) / (profoundThreshold - normalThreshold);
        }

        // Apply reduction factor to amplitude
        return amplitude * reductionFactor;
    };

    const draw = () => {
        if (!analyserRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const renderFrame = () => {
            analyserRef.current.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            // Draw the grayscale (unadjusted) visualization
            for (let i = 0; i < bufferLength; i++) {
                const frequency = (i * audioContextRef.current.sampleRate) / (2 * bufferLength);
                barHeight = dataArray[i];

                // Grayscale color for unadjusted visualization
                ctx.fillStyle = `rgb(${barHeight}, ${barHeight}, ${barHeight})`;
                ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
                x += barWidth + 1;
            }

            // Reset x to draw the audiogram-compressed visualization on top
            x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const frequency = (i * audioContextRef.current.sampleRate) / (2 * bufferLength);
                barHeight = dataArray[i];
                barHeight = applyAudiogramCompression(frequency, barHeight); // Apply compression based on audiogram
                
                // Color overlay (e.g., red) for audiogram-compressed visualization
                ctx.fillStyle = `rgba(255, 0, 0, 0.6)`; // Semi-transparent red overlay
                ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
                x += barWidth + 1;
            }

            requestAnimationFrame(renderFrame);
        };

        renderFrame();
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <h1>Audio File Visualization (With Audiogram Compression)</h1>
            <input type="file" accept="audio/*" onChange={handleFileChange} />
            {audioFile && (
                <audio
                    ref={audioElementRef}
                    src={audioFile}
                    controls
                    onPlay={() => audioContextRef.current.resume()}
                />
            )}
            <canvas ref={canvasRef} width="800" height="300" style={{ border: '1px solid #000' }}></canvas>

            <h2>Audiogram Adjustment</h2>
            <button onClick={() => applyPreset(normalHearingProfile)}>Normal Hearing</button>
            <button onClick={() => applyPreset(ageRelatedHearingLossProfile)}>Age-Related Hearing Loss</button>
            <button onClick={() => applyPreset(ciAudiogramProfile)}>CI User</button>
            <button onClick={() => applyPreset(deafAudiogramProfile)}>Deaf</button>
            
            {Object.keys(audiogram).map((frequency) => (
                <div key={frequency}>
                    <label>{frequency} Hz: </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={audiogram[frequency]}
                        onChange={(e) => handleAudiogramChange(frequency, e.target.value)}
                    />
                    <span>{audiogram[frequency]} dB</span>
                </div>
            ))}
        </div>
    );
};

export default AudioVisualizer;
