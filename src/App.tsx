import { Header } from './components/layout/Header';
import { Toolbar } from './components/layout/Toolbar';
import { InfoPanel } from './components/layout/InfoPanel';
import { CircuitWorkspace } from './components/circuit/CircuitWorkspace';
import { FreeCanvas } from './components/freeMode/FreeCanvas';
import { useModeStore } from './store/modeStore';

function App() {
  const mode = useModeStore((s) => s.mode);

  return (
    <div className="h-screen flex flex-col bg-[#1e1b2e] text-white overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <Toolbar />
        {mode === 'structured' ? <CircuitWorkspace /> : <FreeCanvas />}
        <InfoPanel />
      </div>
    </div>
  );
}

export default App;
