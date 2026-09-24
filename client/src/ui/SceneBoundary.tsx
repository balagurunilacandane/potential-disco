import { Component, type ReactNode } from 'react';
import { SceneMessage } from './Hud.tsx';

/** Keeps the panels usable if the 3D view cannot start (for example, WebGL is turned off). */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D view failed to start', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <SceneMessage
          title="The 3D office couldn't start"
          text="This browser couldn't open a 3D view. Check that hardware acceleration or WebGL is turned on, then reload."
        />
      );
    }
    return this.props.children;
  }
}
