import React, { useEffect, useRef, useState } from 'react';

const LineAudioVisualizer = () => {
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
        125: 90, 250: 80, 500: 95, 1000: 100, 2000: 105, 4000: 110, 8000: 110
    };

    useEffect(() => {
        if (audioFile) {
            const initAudio = () => {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                
                const source = audioContextRef.current.createMediaElementSource(audioElementRef.current);
                source.connect(analyserRef.current);
                analyserRef.current.connect(audioContextRef.current.destination);
                analyserRef.current.fftSize = 1024;
                
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

    const applyPreset = (profile) => {
        setAudiogram(profile);
        audiogramRef.current = { ...profile };
    };

    const getAWeighting = (frequency) => {
        const f = frequency;
        const ra = (Math.pow(12194, 2) * Math.pow(f, 4)) /
            ((Math.pow(f, 2) + Math.pow(20.6, 2)) *
             Math.sqrt((Math.pow(f, 2) + Math.pow(107.7, 2)) * (Math.pow(f, 2) + Math.pow(737.9, 2))) *
             (Math.pow(f, 2) + Math.pow(12194, 2)));
        const aWeighting = 20 * Math.log10(ra) + 2.0;
        return Math.pow(10, aWeighting / 20);
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
        
        const normalThreshold = 0;
        const profoundThreshold = 100;

        let reductionFactor;
        if (adjustmentDb <= normalThreshold) {
            reductionFactor = 1;
        } else if (adjustmentDb >= profoundThreshold) {
            reductionFactor = 0;
        } else {
            reductionFactor = 1 - (adjustmentDb - normalThreshold) / (profoundThreshold - normalThreshold);
        }

        return amplitude * reductionFactor;
    };

    const normalizeAmplitude = (amplitude, minAmp, maxAmp) => {
        return ((amplitude - minAmp) / (maxAmp - minAmp)) * 255;
    };

    const draw = () => {
        if (!analyserRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const renderFrame = () => {
            analyserRef.current.getByteFrequencyData(dataArray);

            const sampleRate = audioContextRef.current.sampleRate;
            
            const minFrequency = 20;
            const maxFrequency = 8000;
            const minIndex = Math.floor((minFrequency / (sampleRate / 2)) * bufferLength);
            const maxIndex = Math.floor((maxFrequency / (sampleRate / 2)) * bufferLength);

            // Calculate min and max amplitude for normalization
            const amplitudes = dataArray.slice(minIndex, maxIndex).map((amplitude, index) => {
                const frequency = (index * sampleRate) / (2 * bufferLength);
                const aWeightedAmplitude = amplitude * getAWeighting(frequency);
                const audiogramAdjustedAmplitude = applyAudiogramCompression(frequency, aWeightedAmplitude);
                return audiogramAdjustedAmplitude;
            });
            const minAmp = Math.min(...amplitudes);
            const maxAmp = Math.max(...amplitudes);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw the adjusted line with A-weighting, audiogram adjustment, and normalization
            ctx.beginPath();
            ctx.strokeStyle = 'rgb(150, 150, 150)'; // Grayscale color
            ctx.lineWidth = 2;
            ctx.moveTo(0, canvas.height);

            for (let i = minIndex; i < maxIndex; i++) {
                const frequency = (i * sampleRate) / (2 * bufferLength);
                const amplitude = normalizeAmplitude(
                    applyAudiogramCompression(
                        frequency,
                        dataArray[i] * getAWeighting(frequency)
                    ), minAmp, maxAmp
                );
                const y = canvas.height - (amplitude / 255) * canvas.height;
                const x = ((i - minIndex) / (maxIndex - minIndex)) * canvas.width;
                ctx.lineTo(x, y);
            }
            ctx.stroke();

            requestAnimationFrame(renderFrame);
        };

        renderFrame();
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <h1>Line Visualization (With A-Weighting, Audiogram Adjustment, and Normalization)</h1>
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

export default LineAudioVisualizer;
