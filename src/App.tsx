import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './Layout'
import Campaigns from './pages/Campaigns'
import CampaignDetail from './pages/CampaignDetail'
import VersionDetail from './pages/VersionDetail'
import Queue from './pages/Queue'
import Audit from './pages/Audit'
import Team from './pages/Team'
import About from './pages/About'
import { Empty } from './ui'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/versions/:id" element={<VersionDetail />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/team" element={<Team />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Empty>Page not found.</Empty>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
