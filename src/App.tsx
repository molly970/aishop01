import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser } from './api/api';
import Navbar from './components/Navbar';
import { loadAuthFromStorage, useAuthStore } from './store/authStore';
import Admin from './pages/Admin';
import DebugPage from './pages/DebugPage';
import Diagnostics from './pages/Diagnostics';
import Home from './pages/Home';
import Login from './pages/Login';
import MyTasks from './pages/MyTasks';
import Notifications from './pages/Notifications';
import ResultSubmitList from './pages/ResultSubmitList';
import Review from './pages/Review';
import SimpleTest from './pages/SimpleTest';
import SubmitResult from './pages/SubmitResult';
import SubmitTask from './pages/SubmitTask';
import TaskDetail from './pages/TaskDetail';
import TaskPublicBoard from './pages/TaskPublicBoard';
import TaskTracking from './pages/TaskTracking';
import TestBasic from './pages/TestBasic';

function App() {
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const canAccessReview = user?.role === 'main_admin' || user?.role === 'expert';

  useEffect(() => {
    const hydrateAuth = async () => {
      loadAuthFromStorage();
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (!savedToken || !savedUser) {
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        login(savedToken, currentUser);
      } catch {
        logout();
      }
    };

    void hydrateAuth();
  }, [login, logout]);

  console.log('用户登录状态:', isLoggedIn);
  console.log('当前用户:', user);
  console.log('当前 Token:', token);

  return (
    <Router>
      <div className="min-h-screen bg-transparent">
        {isLoggedIn && <Navbar />}
        <main className={isLoggedIn ? 'px-4 pb-8 pt-20 lg:ml-[272px] lg:px-9 lg:pt-7' : ''}>
          <Routes>
            <Route path="/login" element={isLoggedIn ? <Navigate to="/" /> : <Login />} />
            <Route path="/" element={isLoggedIn ? <Home /> : <Navigate to="/login" />} />
            <Route path="/submit" element={isLoggedIn ? <SubmitTask /> : <Navigate to="/login" />} />
            <Route path="/result-submit" element={isLoggedIn ? <ResultSubmitList /> : <Navigate to="/login" />} />
            <Route path="/review" element={isLoggedIn ? (canAccessReview ? <Review /> : <Navigate to="/" />) : <Navigate to="/login" />} />
            <Route path="/task/:id" element={isLoggedIn ? <TaskDetail /> : <Navigate to="/login" />} />
            <Route path="/submit-result/:taskId" element={isLoggedIn ? <SubmitResult /> : <Navigate to="/login" />} />
            <Route path="/my-tasks" element={isLoggedIn ? <MyTasks /> : <Navigate to="/login" />} />
            <Route path="/notifications" element={isLoggedIn ? <Notifications /> : <Navigate to="/login" />} />
            <Route path="/admin" element={isLoggedIn ? <Admin /> : <Navigate to="/login" />} />
            <Route path="/task-tracking" element={isLoggedIn ? <TaskTracking /> : <Navigate to="/login" />} />
            <Route path="/public-board" element={isLoggedIn ? <TaskPublicBoard /> : <Navigate to="/login" />} />
            <Route path="/diagnostics" element={isLoggedIn ? <Diagnostics /> : <Navigate to="/login" />} />
            <Route path="/debug" element={isLoggedIn ? <DebugPage /> : <Navigate to="/login" />} />
            <Route path="/simple" element={isLoggedIn ? <SimpleTest /> : <Navigate to="/login" />} />
            <Route path="/test" element={<TestBasic />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
