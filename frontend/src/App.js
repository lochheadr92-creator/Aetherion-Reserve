import { useState, useCallback, useEffect } from 'react';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
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
    try {
      game.newGame(opts);
      setScreen('game');
    } catch (e) {
      console.error('[newGame]', e);
      toast.error('Could not start the facility', { description: e?.message || String(e) });
    }
  }, []);

  const handleLoad = useCallback(async (saveId) => {
    try {
      await game.loadGame(saveId);
      setScreen('game');
    } catch (e) {
      // M3: a failed / corrupt load must never leave the player on a blank screen
      console.error('[loadGame]', e);
      const status = e?.response?.status;
      const why = status === 404 ? 'That save no longer exists.'
        : status ? `Save service returned ${status}.`
          : e?.message ? e.message : 'Save service unreachable.';
      toast.error('Could not load save', { description: why, id: 'load-error' });
      game.stopLoop();
      setScreen('menu');
    }
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
