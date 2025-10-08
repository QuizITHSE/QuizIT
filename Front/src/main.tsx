import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './pages/App.tsx'
import Auth from './pages/Auth.tsx'
import CreateGroup from './pages/CreateGroup.tsx'
import StudentJoin from './pages/StudentJoin.tsx'
import CreateQuiz from './pages/CreateQuiz.tsx'
import HostQuiz from './pages/HostQuiz.tsx'
import PlayQuiz from './pages/PlayQuiz.tsx'
import GameSettings from './pages/GameSettings.tsx'
import QuizResultsTable from './pages/QuizResultsTable.tsx'

const router = createBrowserRouter([
  { path: '/', element: <App/>},
  { path: '/auth', element: <Auth/>},  
  { path: '/create-group', element: <CreateGroup/>},
  { path: '/student-join', element: <StudentJoin/>},
  { path: '/create-quiz', element: <CreateQuiz/>},
  { path: '/game-settings', element: <GameSettings/>},
  { path: '/host', element: <HostQuiz/>},
  { path: '/play', element: <PlayQuiz/>},
  { path: '/results/:gameId', element: <QuizResultsTable/>}
])


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router}/>
  </StrictMode>,
)
