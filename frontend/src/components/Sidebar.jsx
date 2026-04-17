const menu = [
  { id: 'auth', label: 'Login' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'categories', label: 'Categories' },
];

function Sidebar({ currentTab, onTabChange, counts, isAuthenticated }) {
  const visibleMenu = isAuthenticated
    ? menu
    : menu.filter((item) => item.id === 'auth');

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">✓</div>
        <div>
          <h1>Taskist</h1>
          <p>Personal Workspace</p>
        </div>
      </div>

      <nav className="menu">
        {visibleMenu.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`menu-item ${currentTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            <span>{item.label}</span>
            {item.id === 'tasks' && <small>{counts.tasks}</small>}
            {item.id === 'categories' && <small>{counts.categories}</small>}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
