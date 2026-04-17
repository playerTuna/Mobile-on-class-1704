import { useMemo, useState } from 'react';

function TasksPage({ tasks, categories, onCreate, onDelete, onRefresh }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    category_id: '',
  });

  const filteredTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(keyword) ||
        task.description.toLowerCase().includes(keyword),
    );
  }, [search, tasks]);

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-head">
          <h2>Tasks</h2>
          <button type="button" className="ghost" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        <p className="subtext">Create and manage what you need to do today.</p>
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate({
              title: form.title,
              description: form.description,
              due_date: new Date(form.due_date).toISOString(),
              category_id: form.category_id || undefined,
            });
            setForm({ title: '', description: '', due_date: '', category_id: '' });
          }}
        >
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              minLength={3}
              required
            />
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              minLength={3}
              required
            />
          </label>
          <label>
            Due date
            <input
              value={form.due_date}
              onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              type="datetime-local"
              required
            />
          </label>
          <label>
            Category
            <select
              value={form.category_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, category_id: e.target.value }))
              }
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create task</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>All tasks ({tasks.length})</h3>
          <input
            className="search"
            placeholder="Search task..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="record-list">
          {filteredTasks.map((task) => (
            <li key={task.id} className="task-item">
              <div>
                <strong>{task.title}</strong>
                <p>{task.description}</p>
                <div className="subtext">
                  Due: {task.due_date ? new Date(task.due_date).toLocaleString() : '-'} | Category:{' '}
                  {task.category?.name || '-'}
                </div>
              </div>
              <button type="button" className="danger" onClick={() => onDelete(task.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default TasksPage;
