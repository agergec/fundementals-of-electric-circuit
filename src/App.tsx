import { Header } from './components/layout/Header';
import { Toolbar } from './components/layout/Toolbar';
import { InfoPanel } from './components/layout/InfoPanel';
import { CircuitWorkspace } from './components/circuit/CircuitWorkspace';

function App() {
  return (
    <div className="h-screen flex flex-col bg-[#1e1b2e] text-white overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <Toolbar />
        <CircuitWorkspace />
        <InfoPanel />
      </div>
    </div>
  );
}

export default App;
