import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { Profiles } from './pages/Profiles';
import { CreateProfile } from './pages/CreateProfile';
import { ProfileDetail } from './pages/ProfileDetail';

function App() {
  return (
    <ThemeProvider>
      {/* reducedMotion="user" makes every framer-motion animation in the
          app defer to the OS-level prefers-reduced-motion setting. */}
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/profiles" element={<Profiles />} />
              <Route path="/profiles/new" element={<CreateProfile />} />
              <Route path="/profiles/:profileUuid" element={<ProfileDetail />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  );
}

export default App;
