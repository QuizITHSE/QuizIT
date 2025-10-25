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
import StudentGameOverview from './pages/StudentGameOverview.tsx'
import GroupDetails from './pages/GroupDetails.tsx'
import HomeworkQuiz from './pages/HomeworkQuiz.tsx'
import HomeworkResults from './pages/HomeworkResults.tsx'
import EmailConfirmed from './pages/EmailConfirmed.tsx'

const router = createBrowserRouter([
  { path: '/', element: <App/>},
  { path: '/auth', element: <Auth/>},  
  { path: '/create-group', element: <CreateGroup/>},
  { path: '/student-join', element: <StudentJoin/>},
  { path: '/create-quiz', element: <CreateQuiz/>},
  { path: '/game-settings', element: <GameSettings/>},
  { path: '/host', element: <HostQuiz/>},
  { path: '/play', element: <PlayQuiz/>},
  { path: '/results/:gameId', element: <QuizResultsTable/>},
  { path: '/my-results', element: <StudentGameOverview/>},
  { path: '/group-details', element: <GroupDetails/>},
  { path: '/homework-quiz', element: <HomeworkQuiz/>},
  { path: '/homework-results', element: <HomeworkResults/>},
  { path: '/email-confirmed', element: <EmailConfirmed/>}
])


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router}/>
  </StrictMode>,
)
