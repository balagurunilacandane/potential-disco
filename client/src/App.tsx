import { Office } from './scene/Office.tsx';
import { ActivityFeed, Splash, TeamsPanel, Toasts, TopBar } from './ui/Hud.tsx';
import { Inspector } from './ui/Inspector.tsx';
import { Modals } from './ui/Modals.tsx';

export function App() {
  return (
    <div className="app">
      <div className="scene">
        <Office />
      </div>
      <TopBar />
      <div className="side">
        <TeamsPanel />
        <ActivityFeed />
      </div>
      <Inspector />
      <p className="hint">Drag to pan · Right-drag to rotate · Scroll to zoom · Click a worker</p>
      <Modals />
      <Toasts />
      <Splash />
    </div>
  );
}
