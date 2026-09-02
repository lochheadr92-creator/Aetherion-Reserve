import { useState, useCallback, useEffect } from 'react';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import MainMenu from '@/components/game/MainMenu';
import GameScreen from '@/components/game/GameScreen';
import { game } from '@/game/controller';
import { audio } from '@/game/audio';

const TOAST_OPTIONS = {
  style: { background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--text-1)' },
};

function App() {
  const [screen, setScreen] = useState('menu');

  // ambient audio layer: unlocks on first gesture, plays UI clicks + alert stingers
  useEffect(() => { audio.install(); }, []);

  const handleStart = useCallback((opts) => {
    game.newGame(opts);
    setScreen('game');
  }, []);

  const handleLoad = useCallback(async (saveId) => {
    await game.loadGame(saveId);
    setScreen('game');
  }, []);

  const handleExit = useCallback(() => {
    game.stopLoop();
    setScreen('menu');
  }, []);

  return (
    <div className="App">
      {screen === 'menu' ? (
        <MainMenu onStart={handleStart} onLoad={handleLoad} />
      ) : (
        <GameScreen onExit={handleExit} />
      )}
      <Toaster
        position="bottom-right"
        expand={false}
        toastOptions={TOAST_OPTIONS}
      />
    </div>
  );
}

export default App;
