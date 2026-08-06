import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Shell from './layout/Shell'
import Organisation from './pages/Organisation'
import NewProject from './pages/NewProject'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Team from './pages/Team'
import PasswordGate from './components/PasswordGate'

export default function App() {
  return (
    <PasswordGate>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Organisation />} />
            <Route path="nouveau" element={<NewProject />} />
            <Route path="projets" element={<Projects />} />
            <Route path="projets/:id" element={<ProjectDetail />} />
            <Route path="equipe" element={<Team />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PasswordGate>
  )
}
