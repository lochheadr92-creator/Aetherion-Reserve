import { useState, useCallback } from 'react';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import MainMenu from '@/components/game/MainMenu';
import GameScreen from '@/components/game/GameScreen';
import { game } from '@/game/controller';

function App() {
  const [screen, setScreen] = useState('menu');

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
        toastOptions={{
          style: { background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--text-1)' },
        }}
      />
    </div>
  );
}

export default App;
