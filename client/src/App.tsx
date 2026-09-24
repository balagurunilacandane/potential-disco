import { Office } from './scene/Office.tsx';
import { ActivityFeed, CameraBar, Splash, TeamsPanel, Toasts, TopBar, TourCaption, Welcome, useWelcome } from './ui/Hud.tsx';
import { Inspector } from './ui/Inspector.tsx';
import { Modals } from './ui/Modals.tsx';

export function App() {
  const welcome = useWelcome();
  return (
    <div className="app">
      <div className="scene">
        <Office />
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
      {welcome.open && <Welcome onClose={welcome.close} />}
    </div>
  );
}
