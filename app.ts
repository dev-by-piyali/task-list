// Types
interface Task {
  id: string;
  title: string;
  description: string;
  createdAt: number;
}

interface StorageData {
  todos: Task[];
  completed: Task[];
}

type Theme = 'dark' | 'light';

// Storage keys
const STORAGE_KEYS = {
  THEME: 'taskList_theme',
  TODOS: 'taskList_todos',
  COMPLETED: 'taskList_completed',
} as const;

// DOM Elements
const elements = {
  themeToggle: document.getElementById('themeToggle') as HTMLButtonElement,
  themeIcon: document.getElementById('themeIcon') as HTMLSpanElement,
  taskTitle: document.getElementById('taskTitle') as HTMLInputElement,
  taskDescription: document.getElementById('taskDescription') as HTMLInputElement,
  charCount: document.getElementById('charCount') as HTMLSpanElement,
  addBtn: document.getElementById('addBtn') as HTMLButtonElement,
  todoList: document.getElementById('todoList') as HTMLUListElement,
  completedList: document.getElementById('completedList') as HTMLUListElement,
  todoEmpty: document.getElementById('todoEmpty') as HTMLDivElement,
  todoCount: document.getElementById('todoCount') as HTMLSpanElement,
  completedCount: document.getElementById('completedCount') as HTMLSpanElement,
  todoCountBadge: document.getElementById('todoCountBadge') as HTMLSpanElement,
  completedCountBadge: document.getElementById('completedCountBadge') as HTMLSpanElement,
  completedSection: document.getElementById('completedSection') as HTMLDivElement,
  syncIndicator: document.getElementById('syncIndicator') as HTMLDivElement,
};

// State
let draggedItem: HTMLLIElement | null = null;

// Utility functions
function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: Parameters<T>): void {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Sync indicator
function showSyncIndicator(success: boolean = false): void {
  const indicator = elements.syncIndicator;
  const text = indicator.querySelector('.sync-text') as HTMLSpanElement;
  const icon = indicator.querySelector('.sync-icon') as HTMLSpanElement;

  if (success) {
    indicator.classList.add('success');
    text.textContent = 'Saved!';
    icon.textContent = '✓';
    icon.style.animation = 'none';
  } else {
    indicator.classList.remove('success');
    text.textContent = 'Saving...';
    icon.textContent = '⟳';
    icon.style.animation = 'spin 1s linear infinite';
  }

  indicator.classList.add('show');

  setTimeout(() => {
    indicator.classList.remove('show');
  }, success ? 1500 : 800);
}

// Storage functions
const saveToStorage = debounce((): void => {
  showSyncIndicator(false);

  const todoItems: Task[] = Array.from(
    document.querySelectorAll('#todoList li')
  ).map((li) => {
    const id = li.getAttribute('data-id') || generateId();
    const titleEl = li.querySelector('.task-text');
    const descEl = li.querySelector('.task-description');
    const title = titleEl?.textContent || (li.querySelector('.edit-input:not(.edit-description)') as HTMLInputElement)?.value || '';
    const description = descEl?.textContent || (li.querySelector('.edit-description') as HTMLInputElement)?.value || '';
    const createdAt = parseInt(li.getAttribute('data-created') || String(Date.now()), 10);
    
    return { id, title, description, createdAt };
  });

  const completedItems: Task[] = Array.from(
    document.querySelectorAll('#completedList li')
  ).map((li) => {
    const id = li.getAttribute('data-id') || generateId();
    const titleEl = li.querySelector('.task-text');
    const descEl = li.querySelector('.task-description');
    const title = titleEl?.textContent || '';
    const description = descEl?.textContent || '';
    const createdAt = parseInt(li.getAttribute('data-created') || String(Date.now()), 10);
    
    return { id, title, description, createdAt };
  });

  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todoItems));
  localStorage.setItem(STORAGE_KEYS.COMPLETED, JSON.stringify(completedItems));

  setTimeout(() => showSyncIndicator(true), 300);
}, 500);

function loadFromStorage(): void {
  try {
    const todos: Task[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS) || '[]');
    const completed: Task[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED) || '[]');

    todos.forEach((task, index) => {
      if (task.title?.trim()) {
        const li = createTaskElement(task, false);
        li.style.animationDelay = `${index * 0.1}s`;
        elements.todoList.appendChild(li);
      }
    });

    completed.forEach((task, index) => {
      if (task.title?.trim()) {
        const li = createTaskElement(task, true);
        li.style.animationDelay = `${index * 0.1}s`;
        elements.completedList.appendChild(li);
      }
    });

    updateCounts();
    updateSections();
  } catch (e) {
    console.error('Error loading from storage:', e);
  }
}

// Theme functions
function toggleTheme(): void {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') as Theme;
  const newTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme: Theme): void {
  elements.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function loadTheme(): void {
  const savedTheme = (localStorage.getItem(STORAGE_KEYS.THEME) as Theme) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

// Character count
function updateCharCount(): void {
  const count = elements.taskDescription.value.length;
  elements.charCount.textContent = `${count}/100`;
  
  if (count >= 90) {
    elements.charCount.classList.add('warning');
  } else {
    elements.charCount.classList.remove('warning');
  }
}

// Task management
function addItem(): void {
  const title = elements.taskTitle.value.trim();
  const description = elements.taskDescription.value.trim();
  
  if (title === '') return;

  const task: Task = {
    id: generateId(),
    title,
    description,
    createdAt: Date.now(),
  };

  const li = createTaskElement(task, false);
  elements.todoList.prepend(li);
  
  elements.taskTitle.value = '';
  elements.taskDescription.value = '';
  updateCharCount();
  elements.taskTitle.focus();
  
  updateCounts();
  updateSections();
  saveToStorage();

  // Animate input card
  const inputCard = document.querySelector('.input-card') as HTMLDivElement;
  inputCard.style.transform = 'scale(1.02)';
  setTimeout(() => {
    inputCard.style.transform = '';
  }, 150);
}

function createTaskElement(task: Task, isCompleted: boolean): HTMLLIElement {
  const li = document.createElement('li');
  li.draggable = true;
  li.setAttribute('data-id', task.id);
  li.setAttribute('data-created', String(task.createdAt));

  const descriptionHtml = task.description 
    ? `<span class="task-description">${escapeHtml(task.description)}</span>` 
    : '';

  if (isCompleted) {
    li.innerHTML = `
      <span class="drag-handle">⋮⋮</span>
      <div class="checkbox"></div>
      <div class="task-content">
        <span class="task-text">${escapeHtml(task.title)}</span>
        ${descriptionHtml}
      </div>
      <div class="task-actions">
        <button class="action-btn restore-btn" title="Restore">↩</button>
        <button class="action-btn remove-btn" title="Delete">✕</button>
      </div>
    `;

    const checkbox = li.querySelector('.checkbox') as HTMLDivElement;
    const restoreBtn = li.querySelector('.restore-btn') as HTMLButtonElement;
    const removeBtn = li.querySelector('.remove-btn') as HTMLButtonElement;

    checkbox.addEventListener('click', () => restoreItem(li));
    restoreBtn.addEventListener('click', () => restoreItem(li));
    removeBtn.addEventListener('click', () => removeItem(li));
  } else {
    li.innerHTML = `
      <span class="drag-handle">⋮⋮</span>
      <div class="checkbox"></div>
      <div class="task-content">
        <span class="task-text">${escapeHtml(task.title)}</span>
        ${descriptionHtml}
      </div>
      <div class="task-actions">
        <button class="action-btn edit-btn" title="Edit">✎</button>
        <button class="action-btn remove-btn" title="Delete">✕</button>
      </div>
    `;

    const checkbox = li.querySelector('.checkbox') as HTMLDivElement;
    const editBtn = li.querySelector('.edit-btn') as HTMLButtonElement;
    const removeBtn = li.querySelector('.remove-btn') as HTMLButtonElement;

    checkbox.addEventListener('click', () => completeItem(li));
    editBtn.addEventListener('click', () => editItem(li));
    removeBtn.addEventListener('click', () => removeItem(li));
  }

  setupDragEvents(li);
  return li;
}

function completeItem(li: HTMLLIElement): void {
  const titleEl = li.querySelector('.task-text') as HTMLSpanElement;
  const descEl = li.querySelector('.task-description') as HTMLSpanElement | null;
  
  const task: Task = {
    id: li.getAttribute('data-id') || generateId(),
    title: titleEl.textContent || '',
    description: descEl?.textContent || '',
    createdAt: parseInt(li.getAttribute('data-created') || String(Date.now()), 10),
  };

  li.style.animation = 'completeTask 0.4s ease-out forwards';
  setTimeout(() => {
    li.remove();
    const newLi = createTaskElement(task, true);
    elements.completedList.prepend(newLi);
    updateCounts();
    updateSections();
    saveToStorage();
  }, 400);
}

function restoreItem(li: HTMLLIElement): void {
  const titleEl = li.querySelector('.task-text') as HTMLSpanElement;
  const descEl = li.querySelector('.task-description') as HTMLSpanElement | null;
  
  const task: Task = {
    id: li.getAttribute('data-id') || generateId(),
    title: titleEl.textContent || '',
    description: descEl?.textContent || '',
    createdAt: parseInt(li.getAttribute('data-created') || String(Date.now()), 10),
  };

  li.style.animation = 'slideOut 0.3s ease-out forwards';
  setTimeout(() => {
    li.remove();
    const newLi = createTaskElement(task, false);
    elements.todoList.prepend(newLi);
    updateCounts();
    updateSections();
    saveToStorage();
  }, 300);
}

function editItem(li: HTMLLIElement): void {
  const titleEl = li.querySelector('.task-text') as HTMLSpanElement;
  const descEl = li.querySelector('.task-description') as HTMLSpanElement | null;
  const taskContent = li.querySelector('.task-content') as HTMLDivElement;
  const currentTitle = titleEl.textContent || '';
  const currentDescription = descEl?.textContent || '';

  li.draggable = false;

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'edit-input';
  titleInput.value = currentTitle;
  titleInput.maxLength = 100;

  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'edit-input edit-description';
  descInput.value = currentDescription;
  descInput.placeholder = 'Description (optional)';
  descInput.maxLength = 100;

  taskContent.innerHTML = '';
  taskContent.appendChild(titleInput);
  taskContent.appendChild(descInput);
  titleInput.focus();
  titleInput.select();

  const actions = li.querySelector('.task-actions') as HTMLDivElement;
  actions.innerHTML = `
    <button class="action-btn save-btn" title="Save">✓</button>
    <button class="action-btn cancel-btn" title="Cancel">✕</button>
  `;

  const saveBtn = actions.querySelector('.save-btn') as HTMLButtonElement;
  const cancelBtn = actions.querySelector('.cancel-btn') as HTMLButtonElement;

  const save = (): void => {
    const newTitle = titleInput.value.trim();
    const newDescription = descInput.value.trim();

    if (newTitle === '') {
      titleInput.focus();
      titleInput.style.borderColor = 'var(--danger)';
      setTimeout(() => {
        titleInput.style.borderColor = 'var(--accent-primary)';
      }, 500);
      return;
    }

    const descHtml = newDescription 
      ? `<span class="task-description">${escapeHtml(newDescription)}</span>` 
      : '';

    taskContent.innerHTML = `
      <span class="task-text">${escapeHtml(newTitle)}</span>
      ${descHtml}
    `;

    li.draggable = true;

    actions.innerHTML = `
      <button class="action-btn edit-btn" title="Edit">✎</button>
      <button class="action-btn remove-btn" title="Delete">✕</button>
    `;

    const editBtn = actions.querySelector('.edit-btn') as HTMLButtonElement;
    const removeBtn = actions.querySelector('.remove-btn') as HTMLButtonElement;
    editBtn.addEventListener('click', () => editItem(li));
    removeBtn.addEventListener('click', () => removeItem(li));

    li.style.animation = 'none';
    setTimeout(() => {
      li.style.animation = 'slideIn 0.3s ease-out';
    }, 10);

    saveToStorage();
  };

  const cancel = (): void => {
    const descHtml = currentDescription 
      ? `<span class="task-description">${escapeHtml(currentDescription)}</span>` 
      : '';

    taskContent.innerHTML = `
      <span class="task-text">${escapeHtml(currentTitle)}</span>
      ${descHtml}
    `;

    li.draggable = true;

    actions.innerHTML = `
      <button class="action-btn edit-btn" title="Edit">✎</button>
      <button class="action-btn remove-btn" title="Delete">✕</button>
    `;

    const editBtn = actions.querySelector('.edit-btn') as HTMLButtonElement;
    const removeBtn = actions.querySelector('.remove-btn') as HTMLButtonElement;
    editBtn.addEventListener('click', () => editItem(li));
    removeBtn.addEventListener('click', () => removeItem(li));
  };

  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', cancel);

  titleInput.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') save();
  });

  descInput.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') save();
  });

  titleInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') cancel();
  });

  descInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') cancel();
  });
}

function removeItem(li: HTMLLIElement): void {
  li.style.animation = 'slideOut 0.3s ease-out forwards';
  setTimeout(() => {
    li.remove();
    updateCounts();
    updateSections();
    saveToStorage();
  }, 300);
}

// Drag and drop
function setupDragEvents(li: HTMLLIElement): void {
  li.addEventListener('dragstart', handleDragStart);
  li.addEventListener('dragend', handleDragEnd);
  li.addEventListener('dragover', handleDragOver);
  li.addEventListener('dragenter', handleDragEnter);
  li.addEventListener('dragleave', handleDragLeave);
  li.addEventListener('drop', handleDrop);
}

function handleDragStart(this: HTMLLIElement, e: DragEvent): void {
  draggedItem = this;
  this.classList.add('dragging');
  this.closest('.task-list')?.classList.add('drag-active');
  
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
  }

  const ghost = this.cloneNode(true) as HTMLLIElement;
  ghost.style.position = 'absolute';
  ghost.style.top = '-1000px';
  ghost.style.opacity = '0.8';
  document.body.appendChild(ghost);
  e.dataTransfer?.setDragImage(ghost, 20, 20);
  setTimeout(() => ghost.remove(), 0);
}

function handleDragEnd(this: HTMLLIElement): void {
  this.classList.remove('dragging');
  this.closest('.task-list')?.classList.remove('drag-active');

  document.querySelectorAll('.task-list li').forEach((item) => {
    item.classList.remove('drag-over');
  });

  draggedItem = null;
  saveToStorage();
}

function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
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

  if (this !== draggedItem && draggedItem && this.closest('.task-list') === draggedItem.closest('.task-list')) {
    const list = this.closest('.task-list') as HTMLUListElement;
    const items = Array.from(list.querySelectorAll('li'));
    const draggedIndex = items.indexOf(draggedItem);
    const targetIndex = items.indexOf(this);

    if (draggedIndex < targetIndex) {
      this.parentNode?.insertBefore(draggedItem, this.nextSibling);
    } else {
      this.parentNode?.insertBefore(draggedItem, this);
    }

    draggedItem.style.animation = 'none';
    setTimeout(() => {
      if (draggedItem) {
        draggedItem.style.animation = 'slideIn 0.3s ease-out';
      }
    }, 10);
  }

  this.classList.remove('drag-over');
}

// UI updates
function updateCounts(): void {
  const todoCount = document.querySelectorAll('#todoList li').length;
  const completedCount = document.querySelectorAll('#completedList li').length;

  if (elements.todoCount.textContent !== String(todoCount)) {
    elements.todoCount.textContent = String(todoCount);
    elements.todoCountBadge.classList.add('animate');
    setTimeout(() => elements.todoCountBadge.classList.remove('animate'), 300);
  }

  if (elements.completedCount.textContent !== String(completedCount)) {
    elements.completedCount.textContent = String(completedCount);
    elements.completedCountBadge.classList.add('animate');
    setTimeout(() => elements.completedCountBadge.classList.remove('animate'), 300);
  }
}

function updateSections(): void {
  elements.todoEmpty.style.display = elements.todoList.children.length === 0 ? 'block' : 'none';
  elements.completedSection.style.display = elements.completedList.children.length > 0 ? 'block' : 'none';
}

// Event listeners
elements.themeToggle.addEventListener('click', toggleTheme);
elements.addBtn.addEventListener('click', addItem);

elements.taskTitle.addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') addItem();
});

elements.taskDescription.addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') addItem();
});

elements.taskDescription.addEventListener('input', updateCharCount);

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Initialize
loadTheme();
loadFromStorage();