import { useState } from 'react';

function CategoriesPage({ categories, onCreate, onDelete, onRefresh }) {
  const [form, setForm] = useState({ name: '', color: '' });

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-head">
          <h2>Categories</h2>
          <button type="button" className="ghost" onClick={onRefresh}>
            Refresh
          </button>
        </div>
        <p className="subtext">Create categories to keep tasks organized.</p>
        <form
          className="form inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate({
              name: form.name,
              color: form.color || undefined,
            });
            setForm({ name: '', color: '' });
          }}
        >
          <input
            placeholder="Category name"
            minLength={2}
            maxLength={50}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <input
            placeholder="Color (#f97316)"
            value={form.color}
            onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
          />
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="panel">
        <h3>All categories ({categories.length})</h3>
        <ul className="record-list">
          {categories.map((category) => (
            <li key={category.id} className="record-item">
              <div>
                <strong>{category.name}</strong>
                <div className="subtext">Color: {category.color || 'not set'}</div>
              </div>
              <button type="button" className="danger" onClick={() => onDelete(category.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default CategoriesPage;
