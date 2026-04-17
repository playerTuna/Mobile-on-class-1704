import { useState } from 'react';
import Sidebar from './components/Sidebar';
import AuthPage from './pages/AuthPage';
import TasksPage from './pages/TasksPage';
import CategoriesPage from './pages/CategoriesPage';
import { getApiBase, getToken, setToken, clearToken } from './utils/storage';
import { login, register } from './services/authService';
import {
  getCategories,
  createCategory,
  removeCategory,
} from './services/categoryService';
import { getTasks, createTask, removeTask } from './services/taskService';

function App() {
  const [apiBase] = useState(getApiBase());
  const [token, setTokenState] = useState(getToken());
  const [tab, setTab] = useState(getToken() ? 'tasks' : 'auth');
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);

  function pushLog(message, data) {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    const payload = data ? `\n${JSON.stringify(data, null, 2)}` : '';
    console.info(`${line}${payload}`);
  }

  function persistToken(value) {
    setTokenState(value);
    setToken(value);
  }

  function logout() {
    clearToken();
    setTokenState('');
    setTasks([]);
    setCategories([]);
    setTab('auth');
    pushLog('Logged out');
  }

  async function handleRegister(payload) {
    try {
      const data = await register(apiBase, payload);
      persistToken(data.accessToken);
      pushLog('Register success', data.user);
      await Promise.all([refreshTasks(data.accessToken), refreshCategories(data.accessToken)]);
      setTab('tasks');
    } catch (error) {
      pushLog('Register failed', { error: error.message });
    }
  }

  async function handleLogin(payload) {
    try {
      const data = await login(apiBase, payload);
      persistToken(data.accessToken);
      pushLog('Login success', data.user);
      await Promise.all([refreshTasks(data.accessToken), refreshCategories(data.accessToken)]);
      setTab('tasks');
    } catch (error) {
      pushLog('Login failed', { error: error.message });
    }
  }

  async function refreshCategories(forcedToken = token) {
    try {
      const data = await getCategories(apiBase, forcedToken);
      setCategories(data);
      pushLog('Categories loaded', data);
    } catch (error) {
      pushLog('Load categories failed', { error: error.message });
    }
  }

  async function handleCreateCategory(payload) {
    try {
      await createCategory(apiBase, token, payload);
      await refreshCategories();
    } catch (error) {
      pushLog('Create category failed', { error: error.message });
    }
  }

  async function handleDeleteCategory(id) {
    try {
      await removeCategory(apiBase, token, id);
      await Promise.all([refreshCategories(), refreshTasks()]);
    } catch (error) {
      pushLog('Delete category failed', { error: error.message });
    }
  }

  async function refreshTasks(forcedToken = token) {
    try {
      const data = await getTasks(apiBase, forcedToken);
      setTasks(data);
      pushLog('Tasks loaded', data);
    } catch (error) {
      pushLog('Load tasks failed', { error: error.message });
    }
  }

  async function handleCreateTask(payload) {
    try {
      await createTask(apiBase, token, payload);
      await refreshTasks();
    } catch (error) {
      pushLog('Create task failed', { error: error.message });
    }
  }

  async function handleDeleteTask(id) {
    try {
      await removeTask(apiBase, token, id);
      await refreshTasks();
    } catch (error) {
      pushLog('Delete task failed', { error: error.message });
    }
  }

  function handleTabChange(nextTab) {
    if (!token && nextTab !== 'auth') {
      setTab('auth');
      pushLog('Please login before accessing tasks or categories');
      return;
    }
    setTab(nextTab);
  }

  function renderPage() {
    if (tab === 'auth') {
      return <AuthPage onLogin={handleLogin} onRegister={handleRegister} />;
    }
    if (tab === 'categories') {
      return (
        <CategoriesPage
          categories={categories}
          onCreate={handleCreateCategory}
          onDelete={handleDeleteCategory}
          onRefresh={refreshCategories}
        />
      );
    }
    return (
      <TasksPage
        tasks={tasks}
        categories={categories}
        onCreate={handleCreateTask}
        onDelete={handleDeleteTask}
        onRefresh={refreshTasks}
      />
    );
  }

  return (
    <main className="shell">
      <Sidebar
        currentTab={tab}
        onTabChange={handleTabChange}
        counts={{ tasks: tasks.length, categories: categories.length }}
        isAuthenticated={Boolean(token)}
      />
      <section className="content">
        <header className="content-head">
          <div>
            <h2>{tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
            <p className="subtext">Login, create category, then manage your tasks.</p>
          </div>
          {token && tab !== 'auth' ? (
            <div className="quick-actions">
              <button type="button" className="ghost" onClick={logout}>
                Logout
              </button>
              <button type="button" className="ghost" onClick={() => refreshTasks()}>
                Refresh Tasks
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => refreshCategories()}
              >
                Refresh Categories
              </button>
            </div>
          ) : null}
        </header>
        {renderPage()}
      </section>
    </main>
  );
}

export default App;
