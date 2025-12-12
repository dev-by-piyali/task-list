// TYPES
interface Task {
  id: string;
  title: string;
  description: string;
  createdAt: number;
}

interface AppState {
  todos: Task[];
  completed: Task[];
  theme: Theme;
}

type Theme = 'dark' | 'light';
type ListType = 'todos' | 'completed';

// CONSTANTS
const STORAGE_KEYS = {
  THEME: 'taskList_theme',
  TODOS: 'taskList_todos',
  COMPLETED: 'taskList_completed',
} as const;

const ANIMATION_DURATION = {
  SLIDE: 300,
  COMPLETE: 400,
} as const;

// STATE
const state: AppState = {
  todos: [],
  completed: [],
  theme: 'dark',
};

let draggedItem: HTMLLIElement | null = null;

// DOM ELEMENTS (Lazy initialization)
const getElement = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
};

// Cache elements on first access
const elements = {
  get themeToggle() { return getElement<HTMLButtonElement>('themeToggle'); },
  get themeIcon() { return getElement<HTMLSpanElement>('themeIcon'); },
  get taskTitle() { return getElement<HTMLInputElement>('taskTitle'); },
  get taskDescription() { return getElement<HTMLInputElement>('taskDescription'); },
  get charCount() { return getElement<HTMLSpanElement>('charCount'); },
  get addBtn() { return getElement<HTMLButtonElement>('addBtn'); },
  get todoList() { return getElement<HTMLUListElement>('todoList'); },
  get completedList() { return getElement<HTMLUListElement>('completedList'); },
  get todoEmpty() { return getElement<HTMLDivElement>('todoEmpty'); },
  get todoCount() { return getElement<HTMLSpanElement>('todoCount'); },
  get completedCount() { return getElement<HTMLSpanElement>('completedCount'); },
  get todoCountBadge() { return getElement<HTMLSpanElement>('todoCountBadge'); },
  get completedCountBadge() { return getElement<HTMLSpanElement>('completedCountBadge'); },
  get completedSection() { return getElement<HTMLDivElement>('completedSection'); },
  get syncIndicator() { return getElement<HTMLDivElement>('syncIndicator'); },
};

// UTILITIES
const generateId = (): string => 
  `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// More efficient XSS prevention using a cached element
const escapeHtmlElement = document.createElement('div');
const escapeHtml = (text: string): string => {
  escapeHtmlElement.textContent = text;
  return escapeHtmlElement.innerHTML;
};

// TEMPLATES (Centralized HTML generation)
const templates = {
  taskContent: (task: Task): string => `
    <span class="task-text">${escapeHtml(task.title)}</span>
    ${task.description ? `<span class="task-description">${escapeHtml(task.description)}</span>` : ''}
  `,

  todoActions: (): string => `
    <button class="action-btn edit-btn" title="Edit">✎</button>
    <button class="action-btn remove-btn" title="Delete">✕</button>
  `,

  completedActions: (): string => `
    <button class="action-btn restore-btn" title="Restore">↩</button>
    <button class="action-btn remove-btn" title="Delete">✕</button>
  `,

  editActions: (): string => `
    <button class="action-btn save-btn" title="Save">✓</button>
    <button class="action-btn cancel-btn" title="Cancel">✕</button>
  `,

  taskItem: (task: Task, isCompleted: boolean): string => `
    <span class="drag-handle">⋮⋮</span>
    <div class="checkbox"></div>
    <div class="task-content">${templates.taskContent(task)}</div>
    <div class="task-actions">
      ${isCompleted ? templates.completedActions() : templates.todoActions()}
    </div>
  `,
};

// SYNC INDICATOR
const showSyncIndicator = (success = false): void => {
  const { syncIndicator } = elements;
  const text = syncIndicator.querySelector('.sync-text') as HTMLSpanElement;
  const icon = syncIndicator.querySelector('.sync-icon') as HTMLSpanElement;

  syncIndicator.classList.toggle('success', success);
  text.textContent = success ? 'Saved!' : 'Saving...';
  icon.textContent = success ? '✓' : '⟳';
  icon.style.animation = success ? 'none' : 'spin 1s linear infinite';

  syncIndicator.classList.add('show');
  setTimeout(() => syncIndicator.classList.remove('show'), success ? 1500 : 800);
};

// STORAGE (State-based, not DOM-based)
const saveToStorage = debounce((): void => {
  showSyncIndicator(false);

  try {
    localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
    localStorage.setItem(STORAGE_KEYS.COMPLETED, JSON.stringify(state.completed));
    setTimeout(() => showSyncIndicator(true), 300);
  } catch (e) {
    console.error('Error saving to storage:', e);
  }
}, 500);

const loadFromStorage = (): void => {
  try {
    state.todos = JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS) || '[]');
    state.completed = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED) || '[]');
    state.theme = (localStorage.getItem(STORAGE_KEYS.THEME) as Theme) || 'dark';

    // Render loaded tasks
    state.todos.forEach((task, i) => renderTask(task, 'todos', i * 0.1));
    state.completed.forEach((task, i) => renderTask(task, 'completed', i * 0.1));

    updateUI();
  } catch (e) {
    console.error('Error loading from storage:', e);
  }
};

// STATE MANAGEMENT
const findTaskIndex = (id: string, list: ListType): number => 
  state[list].findIndex(t => t.id === id);

const addTask = (task: Task): void => {
  state.todos.unshift(task);
  saveToStorage();
};

const removeTask = (id: string, list: ListType): Task | undefined => {
  const index = findTaskIndex(id, list);
  if (index === -1) return undefined;
  const [task] = state[list].splice(index, 1);
  saveToStorage();
  return task;
};

const updateTask = (id: string, updates: Partial<Task>): void => {
  const index = findTaskIndex(id, 'todos');
  if (index !== -1) {
    state.todos[index] = { ...state.todos[index], ...updates };
    saveToStorage();
  }
};

const moveTask = (id: string, from: ListType, to: ListType): Task | undefined => {
  const task = removeTask(id, from);
  if (task) {
    state[to].unshift(task);
    saveToStorage();
  }
  return task;
};

const reorderTasks = (list: ListType, fromIndex: number, toIndex: number): void => {
  const [task] = state[list].splice(fromIndex, 1);
  state[list].splice(toIndex, 0, task);
  saveToStorage();
};

// THEME
const setTheme = (theme: Theme): void => {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  elements.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
};

const toggleTheme = (): void => {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
};

// UI UPDATES
const updateUI = (): void => {
  const todoCount = state.todos.length;
  const completedCount = state.completed.length;

  // Update counts with animation
  updateCount(elements.todoCount, elements.todoCountBadge, todoCount);
  updateCount(elements.completedCount, elements.completedCountBadge, completedCount);

  // Update section visibility
  elements.todoEmpty.style.display = todoCount === 0 ? 'block' : 'none';
  elements.completedSection.style.display = completedCount > 0 ? 'block' : 'none';
};

const updateCount = (
  countEl: HTMLSpanElement, 
  badgeEl: HTMLSpanElement, 
  count: number
): void => {
  if (countEl.textContent !== String(count)) {
    countEl.textContent = String(count);
    badgeEl.classList.add('animate');
    setTimeout(() => badgeEl.classList.remove('animate'), 300);
  }
};

const updateCharCount = (): void => {
  const count = elements.taskDescription.value.length;
  elements.charCount.textContent = `${count}/100`;
  elements.charCount.classList.toggle('warning', count >= 90);
};

// TASK RENDERING
const renderTask = (task: Task, list: ListType, delay = 0): HTMLLIElement => {
  const li = document.createElement('li');
  li.draggable = true;
  li.dataset.id = task.id;
  li.dataset.created = String(task.createdAt);
  li.innerHTML = templates.taskItem(task, list === 'completed');
  li.style.animationDelay = `${delay}s`;

  attachTaskEvents(li, list === 'completed');
  
  const targetList = list === 'todos' ? elements.todoList : elements.completedList;
  targetList.prepend(li);

  return li;
};

const attachTaskEvents = (li: HTMLLIElement, isCompleted: boolean): void => {
  const checkbox = li.querySelector('.checkbox') as HTMLDivElement;
  const removeBtn = li.querySelector('.remove-btn') as HTMLButtonElement;

  checkbox.addEventListener('click', () => 
    isCompleted ? handleRestore(li) : handleComplete(li)
  );
  removeBtn.addEventListener('click', () => handleRemove(li, isCompleted ? 'completed' : 'todos'));

  if (isCompleted) {
    li.querySelector('.restore-btn')?.addEventListener('click', () => handleRestore(li));
  } else {
    li.querySelector('.edit-btn')?.addEventListener('click', () => handleEdit(li));
  }

  setupDragEvents(li);
};

// EVENT HANDLERS
const handleAdd = (): void => {
  const title = elements.taskTitle.value.trim();
  const description = elements.taskDescription.value.trim();

  if (!title) return;

  const task: Task = {
    id: generateId(),
    title,
    description,
    createdAt: Date.now(),
  };

  addTask(task);
  renderTask(task, 'todos');
  updateUI();

  // Reset form
  elements.taskTitle.value = '';
  elements.taskDescription.value = '';
  updateCharCount();
  elements.taskTitle.focus();

  // Animate input card
  animateElement('.input-card', 'scale(1.02)', 150);
};

const handleComplete = (li: HTMLLIElement): void => {
  const id = li.dataset.id!;
  
  li.style.animation = 'completeTask 0.4s ease-out forwards';
  setTimeout(() => {
    li.remove();
    const task = moveTask(id, 'todos', 'completed');
    if (task) {
      renderTask(task, 'completed');
      updateUI();
    }
  }, ANIMATION_DURATION.COMPLETE);
};

const handleRestore = (li: HTMLLIElement): void => {
  const id = li.dataset.id!;

  li.style.animation = 'slideOut 0.3s ease-out forwards';
  setTimeout(() => {
    li.remove();
    const task = moveTask(id, 'completed', 'todos');
    if (task) {
      renderTask(task, 'todos');
      updateUI();
    }
  }, ANIMATION_DURATION.SLIDE);
};

const handleRemove = (li: HTMLLIElement, list: ListType): void => {
  const id = li.dataset.id!;

  li.style.animation = 'slideOut 0.3s ease-out forwards';
  setTimeout(() => {
    li.remove();
    removeTask(id, list);
    updateUI();
  }, ANIMATION_DURATION.SLIDE);
};

const handleEdit = (li: HTMLLIElement): void => {
  const id = li.dataset.id!;
  const taskIndex = findTaskIndex(id, 'todos');
  if (taskIndex === -1) return;

  const task = state.todos[taskIndex];
  const taskContent = li.querySelector('.task-content') as HTMLDivElement;
  const actions = li.querySelector('.task-actions') as HTMLDivElement;

  li.draggable = false;

  // Create edit inputs
  const titleInput = createInput('edit-input', task.title, 100);
  const descInput = createInput('edit-input edit-description', task.description, 100, 'Description (optional)');

  taskContent.innerHTML = '';
  taskContent.append(titleInput, descInput);
  titleInput.focus();
  titleInput.select();

  actions.innerHTML = templates.editActions();

  // Event handlers
  const save = (): void => {
    const newTitle = titleInput.value.trim();
    const newDescription = descInput.value.trim();

    if (!newTitle) {
      titleInput.focus();
      titleInput.style.borderColor = 'var(--danger)';
      setTimeout(() => titleInput.style.borderColor = 'var(--accent-primary)', 500);
      return;
    }

    updateTask(id, { title: newTitle, description: newDescription });
    restoreTaskView(li, { ...task, title: newTitle, description: newDescription });
  };

  const cancel = (): void => restoreTaskView(li, task);

  // Attach events
  actions.querySelector('.save-btn')?.addEventListener('click', save);
  actions.querySelector('.cancel-btn')?.addEventListener('click', cancel);
  
  [titleInput, descInput].forEach(input => {
    input.addEventListener('keypress', (e) => e.key === 'Enter' && save());
    input.addEventListener('keydown', (e) => e.key === 'Escape' && cancel());
  });
};

const restoreTaskView = (li: HTMLLIElement, task: Task): void => {
  const taskContent = li.querySelector('.task-content') as HTMLDivElement;
  const actions = li.querySelector('.task-actions') as HTMLDivElement;

  taskContent.innerHTML = templates.taskContent(task);
  actions.innerHTML = templates.todoActions();

  li.draggable = true;

  actions.querySelector('.edit-btn')?.addEventListener('click', () => handleEdit(li));
  actions.querySelector('.remove-btn')?.addEventListener('click', () => handleRemove(li, 'todos'));

  animateElement(li, 'slideIn 0.3s ease-out');
};

// DRAG AND DROP
const setupDragEvents = (li: HTMLLIElement): void => {
  li.addEventListener('dragstart', handleDragStart);
  li.addEventListener('dragend', handleDragEnd);
  li.addEventListener('dragover', handleDragOver);
  li.addEventListener('dragenter', handleDragEnter);
  li.addEventListener('dragleave', handleDragLeave);
  li.addEventListener('drop', handleDrop);
};

function handleDragStart(this: HTMLLIElement, e: DragEvent): void {
  draggedItem = this;
  this.classList.add('dragging');
  this.closest('.task-list')?.classList.add('drag-active');

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id || '');
  }
}

function handleDragEnd(this: HTMLLIElement): void {
  this.classList.remove('dragging');
  this.closest('.task-list')?.classList.remove('drag-active');
  document.querySelectorAll('.task-list li').forEach(item => item.classList.remove('drag-over'));
  draggedItem = null;
}

function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(this: HTMLLIElement, e: DragEvent): void {
  e.preventDefault();
  if (this !== draggedItem && this.closest('.task-list') === draggedItem?.closest('.task-list')) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(this: HTMLLIElement): void {
  this.classList.remove('drag-over');
}

function handleDrop(this: HTMLLIElement, e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove('drag-over');

  if (!draggedItem || this === draggedItem) return;
  
  const list = this.closest('.task-list') as HTMLUListElement;
  if (list !== draggedItem.closest('.task-list')) return;

  const items = Array.from(list.querySelectorAll('li'));
  const fromIndex = items.indexOf(draggedItem);
  const toIndex = items.indexOf(this);

  // Update DOM
  if (fromIndex < toIndex) {
    this.parentNode?.insertBefore(draggedItem, this.nextSibling);
  } else {
    this.parentNode?.insertBefore(draggedItem, this);
  }

  // Update state
  const listType: ListType = list.id === 'todoList' ? 'todos' : 'completed';
  reorderTasks(listType, fromIndex, toIndex);

  animateElement(draggedItem, 'slideIn 0.3s ease-out');
}

// HELPERS
const createInput = (
  className: string, 
  value: string, 
  maxLength: number, 
  placeholder = ''
): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = className;
  input.value = value;
  input.maxLength = maxLength;
  if (placeholder) input.placeholder = placeholder;
  return input;
};

const animateElement = (
  target: HTMLElement | string, 
  animation: string, 
  duration?: number
): void => {
  const el = typeof target === 'string' 
    ? document.querySelector(target) as HTMLElement 
    : target;
  
  if (!el) return;

  if (animation.includes(' ')) {
    // Full animation string (e.g., 'slideIn 0.3s ease-out')
    el.style.animation = 'none';
    setTimeout(() => el.style.animation = animation, 10);
  } else {
    // Transform value
    el.style.transform = animation;
    if (duration) {
      setTimeout(() => el.style.transform = '', duration);
    }
  }
};

// INITIALIZATION
const init = (): void => {
  // Set theme
  setTheme(state.theme);
  
  // Load data
  loadFromStorage();

  // Event listeners
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.addBtn.addEventListener('click', handleAdd);
  elements.taskTitle.addEventListener('keypress', (e) => e.key === 'Enter' && handleAdd());
  elements.taskDescription.addEventListener('keypress', (e) => e.key === 'Enter' && handleAdd());
  elements.taskDescription.addEventListener('input', updateCharCount);

  // Prevent default drag behavior
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
};

// Start the app
init();