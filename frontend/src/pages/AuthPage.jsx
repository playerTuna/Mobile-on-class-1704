import { useState } from 'react';

function AuthPage({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login');
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  return (
    <div className="page-grid auth-layout">
      {mode === 'register' ? (
        <section className="panel">
        <h2>Create account</h2>
        <p className="subtext">Create your account to start organizing personal tasks.</p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            onRegister(registerForm);
          }}
        >
          <label>
            Full name
            <input
              value={registerForm.name}
              onChange={(e) =>
                setRegisterForm((prev) => ({ ...prev, name: e.target.value }))
              }
              minLength={3}
              maxLength={20}
              required
            />
          </label>
          <label>
            Email
            <input
              value={registerForm.email}
              onChange={(e) =>
                setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
              }
              type="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={registerForm.password}
              onChange={(e) =>
                setRegisterForm((prev) => ({ ...prev, password: e.target.value }))
              }
              type="password"
              minLength={6}
              maxLength={20}
              required
            />
          </label>
          <button type="submit">Register</button>
        </form>
          <p className="subtext inline-hint">
            Already have an account?{' '}
            <button type="button" className="text-link" onClick={() => setMode('login')}>
              Go to login
            </button>
          </p>
      </section>
      ) : (
      <section className="panel">
        <h2>Sign in</h2>
        <p className="subtext">Sign in and continue with your task list.</p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(loginForm);
          }}
        >
          <label>
            Email
            <input
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm((prev) => ({ ...prev, email: e.target.value }))
              }
              type="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((prev) => ({ ...prev, password: e.target.value }))
              }
              type="password"
              required
            />
          </label>
          <button type="submit">Login</button>
        </form>
          <p className="subtext inline-hint">
            No account yet?{' '}
            <button
              type="button"
              className="text-link"
              onClick={() => setMode('register')}
            >
              Create one here
            </button>
          </p>
      </section>
      )}
    </div>
  );
}

export default AuthPage;
