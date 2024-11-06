import React, { useState } from 'react';
import LineAudioVisualizer from './LineAudioVisualizer';
import BarAudioVisualizer from './BarAudioVisualizer'; // Rename the original visualizer component

const App = () => {
    const [view, setView] = useState('bar'); // Default to bar visualization

    return (
        <div style={{ textAlign: 'center' }}>
            <h1>Music Visualizer</h1>
            <div>
                <button onClick={() => setView('bar')}>Bar Visualization</button>
                <button onClick={() => setView('line')}>Line Visualization</button>
            </div>
            {view === 'bar' ? <BarAudioVisualizer /> : <LineAudioVisualizer />}
        </div>
    );
};

export default App;
