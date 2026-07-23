import { Route, Routes } from 'react-router'
import HomeRoute from './routes/home'
import RootRoute from './routes/root'

export default function App() {
  return (
    <Routes>
      <Route element={<RootRoute />}>
        <Route index element={<HomeRoute />} />
      </Route>
    </Routes>
  )
}
