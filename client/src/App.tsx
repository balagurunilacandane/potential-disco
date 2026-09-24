import { Office } from './scene/Office.tsx';
import { ActivityFeed, CameraBar, DiagnosticsPanel, GraphicsNotice, Splash, TeamsPanel, Toasts, TopBar, TourCaption, Welcome, useWelcome } from './ui/Hud.tsx';
import { SceneBoundary } from './ui/SceneBoundary.tsx';
import { Inspector } from './ui/Inspector.tsx';
import { Modals } from './ui/Modals.tsx';

export function App() {
  const welcome = useWelcome();
  return (
    <div className="app">
      <div className="scene">
        <SceneBoundary>
          <Office />
        </SceneBoundary>
      </div>
      <TopBar onHelp={welcome.show} />
      <div className="side">
        <TeamsPanel />
        <ActivityFeed />
      </div>
      <Inspector />
      <TourCaption />
      <CameraBar />
      <Modals />
      <Toasts />
      <Splash />
      <GraphicsNotice />
      <DiagnosticsPanel />
      {welcome.open && <Welcome onClose={welcome.close} />}
    </div>
  );
}
