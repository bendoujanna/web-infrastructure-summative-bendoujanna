document.addEventListener('DOMContentLoaded', () => {
    // Section switching
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('main > section');

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const target = link.dataset.target;
            sections.forEach(sec => {
                if (sec.id === target) {
                    sec.classList.add('active-section');
                    sec.classList.remove('hidden-section');
                } else {
                    sec.classList.remove('active-section');
                    sec.classList.add('hidden-section');
                }
            });
        });
    });

    // DOM elements
    const taskTableBody = document.getElementById('task-table-body');
    const roommateFilter = document.getElementById('roommate-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const searchBar = document.getElementById('search-bar');
    const statusButtons = {
        all: document.getElementById('status-all'),
        pending: document.getElementById('status-pending'),
        done: document.getElementById('status-done')
    };
    const sortPriority = document.getElementById('sort-priority');
    const sortDueDate = document.getElementById('sort-due-date');

    let tasks = [];
    let roommates = [];
    let currentFilters = {status: 'all', priority: 'all', roommate: 'all', search: ''};
    let currentSort = {priority: 'low-high', dueDate: 'near-far'};

    // Fetch tasks and roommates
    async function fetchTasks() {
        const res = await fetch('http://127.0.0.1:5000/tasks');
        tasks = await res.json();
        renderTasks();
    }

    async function fetchRoommates() {
        const res = await fetch('http://127.0.0.1:5000/roommates');
        roommates = await res.json();

        // Fill filters
        roommateFilter.innerHTML = '<option value="all">All roommates</option>';
        roommates.forEach(r => {
            const option = document.createElement('option');
            option.value = r.id;
            option.textContent = r.name;
            roommateFilter.appendChild(option);
        });

        // Fill add-task select
        const taskRoommateSelect = document.getElementById('task-roommate');
        taskRoommateSelect.innerHTML = '<option value="">Select a roommate</option>';
        roommates.forEach(r => {
            const option = document.createElement('option');
            option.value = r.id;
            option.textContent = r.name;
            taskRoommateSelect.appendChild(option);
        });
    }

    function renderTasks() {
        let filtered = [...tasks];

        // Apply filters
        filtered = filtered.filter(t => {
            let match = true;

            if (currentFilters.status !== 'all') {
                match = match && (currentFilters.status === 'done' ? t.status === 'done' : t.status !== 'done');
            }
            if (currentFilters.priority !== 'all') {
                match = match && t.priority === currentFilters.priority;
            }
            if (currentFilters.roommate !== 'all') {
                match = match && String(t.roommate_id) === String(currentFilters.roommate);
            }
            if (currentFilters.search) {
                match = match && t.title.toLowerCase().includes(currentFilters.search.toLowerCase());
            }
            return match;
        });

        // Apply sorting
        filtered.sort((a, b) => {
            // Priority sort
            const priorityOrder = {Low: 1, Medium: 2, High: 3};
            if (sortPriority.value === 'low-high') {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            } else if (sortPriority.value === 'high-low') {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return 0;
        });

        // Due date sort
        filtered.sort((a, b) => {
            const dateA = new Date(a.due_date);
            const dateB = new Date(b.due_date);
            if (sortDueDate.value === 'near-far') return dateA - dateB;
            else return dateB - dateA;
        });

        // Render
        taskTableBody.innerHTML = '';
        filtered.forEach(t => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.status === 'done' ? 'Done' : 'Pending'}</td>
                <td>${t.title}</td>
                <td>${getRoommateName(t.roommate_id)}</td>
                <td>${t.priority}</td>
                <td>${t.due_date}</td>
                <td>
                    ${t.status !== 'done' ? `<button class="mark-done-btn" data-id="${t.id}">Mark Done</button>` : ''}
                    <button class="delete-btn" data-id="${t.id}">Delete</button>
                </td>
            `;
            taskTableBody.appendChild(row);
        });

        attachRowEvents();
    }

    function getRoommateName(id) {
        const r = roommates.find(r => r.id == id);
        return r ? r.name : '';
    }

    function attachRowEvents() {
        // Mark done
        document.querySelectorAll('.mark-done-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const taskId = btn.dataset.id;
                await fetch(`http://127.0.0.1:5000/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({status: 'done'})
                });
                await fetchTasks();
            });
        });

        // Delete
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const taskId = btn.dataset.id;
                await fetch(`http://127.0.0.1:5000/tasks/${taskId}`, {method: 'DELETE'});
                await fetchTasks();
            });
        });
    }

    // Filters event listeners
    // roommateFilter.addEventListener('change', () => {
    //     currentFilters.roommate = roommateFilter.value;
    //     renderTasks();
    // });

    if (roommateFilter) {
        roommateFilter.addEventListener('change', () => {
            currentFilters.roommate = roommateFilter.value;
            renderTasks();
        });
    }

    // priorityFilter.addEventListener('change', () => {
    //     currentFilters.priority = priorityFilter.value;
    //     renderTasks();
    // });

    if (priorityFilter) {
        priorityFilter.addEventListener('change', () => {
            currentFilters.priority = priorityFilter.value;
            renderTasks();
        });
    }

    searchBar.addEventListener('input', () => {
        currentFilters.search = searchBar.value;
        renderTasks();
    });

    Object.entries(statusButtons).forEach(([key, btn]) => {
        btn.addEventListener('click', () => {
            currentFilters.status = key;
            Object.values(statusButtons).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTasks();
        });
    });

    sortPriority.addEventListener('change', () => {
        currentSort.priority = sortPriority.value;
        renderTasks();
    });

    sortDueDate.addEventListener('change', () => {
        currentSort.dueDate = sortDueDate.value;
        renderTasks();
    });

    // Add task form
    document.getElementById('add-task-form').addEventListener('submit', async e => {
        e.preventDefault();
        const data = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            roommate_id: document.getElementById('task-roommate').value,
            priority: document.getElementById('task-priority').value,
            due_date: document.getElementById('task-due').value,
        };
        await fetch('http://127.0.0.1:5000/tasks', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        e.target.reset();
        await fetchTasks();
    });

    // Add roommate form
    document.getElementById('add-roommate-form').addEventListener('submit', async e => {
        e.preventDefault();
        const data = {name: document.getElementById('roommate-name').value};
        await fetch('http://127.0.0.1:5000/roommates', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        e.target.reset();
        await fetchRoommates();
    });

    // Initial fetch
    fetchRoommates();
    fetchTasks();
});

