document.addEventListener('DOMContentLoaded', () => {
    
    // --- API CONFIGURATION ---
    const API_URL = "http://127.0.0.1:5000";

    // --- DOM ELEMENTS ---
    // Section Switching
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('main > section');

    // Filters & Sorts
    const roommateFilter = document.getElementById('roommate-filter');
    // Correction: In your HTML the ID is 'filter-priorities'
    const priorityFilter = document.getElementById('filter-priorities'); 
    const searchBar = document.getElementById('search-bar');
    const statusButtons = {
        all: document.getElementById('status-all'),
        pending: document.getElementById('status-pending'),
        done: document.getElementById('status-done')
    };
    const sortPriority = document.getElementById('sort-priority');
    const sortDueDate = document.getElementById('sort-due-date');

    // Tables & Map
    const taskTableBody = document.getElementById('task-table-body');
    const roommateTableBody = document.getElementById('roommate-table-body');
    const mapContainer = document.getElementById('house-map');

    // Forms
    const taskRoommateSelect = document.getElementById('task-roommate');
    const taskRoomSelect = document.getElementById('task-room-id'); // For Location

    // --- STATE MANAGEMENT ---
    let tasks = [];
    let roommates = [];
    let rooms = []; // For map
    
    let currentFilters = {status: 'all', priority: 'all', roommate: 'all', search: ''};
    let currentSort = {priority: 'low-high', dueDate: 'near-far'};


    // --- 1. NAVIGATION LOGIC ---
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


    // --- 2. FETCHING DATA (GET) ---

    async function fetchAllData() {
        await Promise.all([fetchRooms(), fetchRoommates(), fetchTasks()]);
        // We render the map last to ensure we have tasks count available
        renderMap(); 
    }

    // A. Fetch Rooms (For Map & Dropdown)
    async function fetchRooms() {
        try {
            const res = await fetch(`${API_URL}/rooms`); 

            if(res.ok) {
                rooms = await res.json();
                populateRoomDropdown();
            }
        } catch (error) {
            console.error("Error fetching rooms:", error);
        }
    }

    // B. Fetch Roommates
    async function fetchRoommates() {
        const res = await fetch(`${API_URL}/roommates`);
        roommates = await res.json();
        
        populateRoommateDropdowns();
        renderRoommateTable();
    }

    // C. Fetch Tasks
    async function fetchTasks() {
        // We use the "Upcoming" or "Overdue" routes for dashboards, 
        // but for the main table, we want ALL tasks.
        const res = await fetch(`${API_URL}/tasks`); // Or /tasks/upcoming based on view
        tasks = await res.json();
        renderTasks();
        renderMap(); // Re-render map to update counters
    }


    // --- 3. RENDERING UI ---

    // A. Populate Select Menus
    function populateRoomDropdown() {
        // Clear existing (except first option)
        taskRoomSelect.innerHTML = '<option value="">Select a room</option>';
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = room.name;
            taskRoomSelect.appendChild(option);
        });
    }

    function populateRoommateDropdowns() {
        // Filter dropdown
        roommateFilter.innerHTML = '<option value="all">All roommates</option>';
        // Form dropdown
        taskRoommateSelect.innerHTML = '<option value="">Select a roommate</option>';

        roommates.forEach(r => {
            // Filter
            const opt1 = document.createElement('option');
            opt1.value = r.id;
            opt1.textContent = r.name;
            roommateFilter.appendChild(opt1);

            // Form
            const opt2 = document.createElement('option');
            opt2.value = r.id;
            opt2.textContent = r.name;
            taskRoommateSelect.appendChild(opt2);
        });
    }

    // B. Render Task Table
    function renderTasks() {
        let filtered = [...tasks];

        // Apply Filters
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

        // Apply Sorting
        filtered.sort((a, b) => {
            const priorityOrder = {Low: 1, Medium: 2, High: 3};
            if (currentSort.priority === 'low-high') return priorityOrder[a.priority] - priorityOrder[b.priority];
            if (currentSort.priority === 'high-low') return priorityOrder[b.priority] - priorityOrder[a.priority];
            return 0;
        });

        filtered.sort((a, b) => {
            const dateA = new Date(a.due_date);
            const dateB = new Date(b.due_date);
            if (currentSort.dueDate === 'near-far') return dateA - dateB;
            else return dateB - dateA;
        });

        // Generate HTML
        taskTableBody.innerHTML = '';
        filtered.forEach(t => {
            const row = document.createElement('tr');
            
            // Find Room Name & Roommate Name helper
            const rName = roommates.find(r => r.id == t.roommate_id)?.name || 'Unassigned';
            // If backend sends room_name (via JOIN) use it, otherwise find in rooms array
            const roomName = t.room_name || rooms.find(r => r.id == t.room_id)?.name || 'Unknown';

            row.innerHTML = `
                <td><span class="status-badge ${t.status}">${t.status}</span></td>
                <td>${t.title}</td>
                <td>${roomName}</td> <td>${rName}</td>
                <td>${t.priority}</td>
                <td>${t.due_date}</td>
                <td>
                    ${t.status !== 'done' ? `<button class="btn-action btn-done" data-id="${t.id}">Done</button>` : ''}
                    <button class="btn-action btn-delete" data-id="${t.id}">Delete</button>
                </td>
            `;
            taskTableBody.appendChild(row);
        });

        attachTaskEvents();
        updateStats(filtered); // Update dashboard numbers
    }

    // C. Render Roommate Table
    // --- MODAL LOGIC ---
    const modal = document.getElementById('roommate-modal');
    const btnOpenModal = document.getElementById('btn-open-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');

    // Open
    if(btnOpenModal) {
        btnOpenModal.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });
    }

    // Close helpers
    const closeModal = () => modal.classList.add('hidden');
    if(btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if(btnCancelModal) btnCancelModal.addEventListener('click', closeModal);
    
    // Close if clicking outside the white box
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });


    // --- RENDER ROOMMATES AS CARDS ---
    const roommatesGrid = document.getElementById('roommates-grid');

    function renderRoommateTable() { // Keeping function name same to avoid breaking other calls
        roommatesGrid.innerHTML = '';
        
        roommates.forEach(r => {
            // 1. Get Initials (e.g. "Taylor Brown" -> "TB")
            const initials = r.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
            
            // 2. Random Color for Avatar
            const colors = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e'];
            const color = colors[r.id % colors.length]; // Consistent color based on ID

            // 3. Create Card HTML
            const card = document.createElement('div');
            card.className = 'roommate-card';
            card.innerHTML = `
                <div class="card-avatar" style="background-color: ${color}">
                    ${initials}
                </div>
                <div class="card-info">
                    <h4>${r.name}</h4>
                    <span class="role">Roommate</span> <div class="email">
                        ✉️ ${r.email}
                    </div>
                </div>
                <button class="btn-delete-card" data-id="${r.id}">&times;</button>
            `;
            
            roommatesGrid.appendChild(card);
        });

        // Attach Delete Events to the new 'x' buttons
        document.querySelectorAll('.btn-delete-card').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Remove this roommate?')) {
                    await fetch(`${API_URL}/roommates/${btn.dataset.id}`, {method: 'DELETE'});
                    fetchRoommates(); 
                }
            });
        });
    }

    // --- FORM SUBMISSION (INSIDE MODAL) ---
    document.getElementById('add-roommate-form').addEventListener('submit', async e => {
        e.preventDefault();
        
        const data = {
            name: document.getElementById('roommate-name').value,
            email: document.getElementById('roommate-email').value
            // Note: We are ignoring 'role' here because the DB doesn't have it yet, 
            // but the UI looks like the screenshot!
        };

        const res = await fetch(`${API_URL}/roommates`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        if (res.ok) {
            e.target.reset();
            closeModal(); // Close popup
            fetchRoommates(); // Refresh grid
        } else {
            const err = await res.json();
            alert("Error: " + err.error);
        }
    });

    // --- GLOBAL MAP STATE ---
    let selectedRoomId = null;

    // Render widgets on the map
    function renderMap() {
        const mapContainer = document.getElementById('house-map');
        mapContainer.innerHTML = ''; 
        
        rooms.forEach(room => {
            const pendingTasks = tasks.filter(t => t.room_id === room.id && t.status !== 'done');
            const count = pendingTasks.length;
            const isBusy = count > 0;

            // Set color theme
            let themeClass = 'theme-blue';
            if (room.color === 'purple') themeClass = 'theme-purple';
            if (room.color === 'orange') themeClass = 'theme-orange';
            if (room.color === 'green') themeClass = 'theme-green';

            // Create widget element
            const widget = document.createElement('div');
            widget.className = `room-widget ${selectedRoomId === room.id ? 'active' : ''}`;
            widget.style.left = `${room.pos_x}px`;
            widget.style.top = `${room.pos_y}px`;

            widget.innerHTML = `
                <div class="status-dot ${isBusy ? 'bg-red' : 'bg-green'}"></div>
                <div class="widget-header">
                    <span class="widget-title">${room.name}</span>
                    <div class="widget-icon ${themeClass}">
                        ${room.name.charAt(0)}
                    </div>
                </div>
                <div class="widget-body">
                    ${isBusy 
                        ? `<span class="task-pill urgent">${count} Tasks</span>` 
                        : `<span class="task-pill">All Clean</span>`
                    }
                </div>
            `;
            
            // Handle widget click
            widget.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent background click
                selectRoom(room);
            });

            mapContainer.appendChild(widget);
        });
    }

    // --- SELECTION LOGIC ---

    function selectRoom(room) {
        selectedRoomId = room.id;
        
        // Refresh widgets visuals
        document.querySelectorAll('.room-widget').forEach(w => w.classList.remove('active'));
        renderMap(); 

        // Switch sidebar states
        const placeholder = document.getElementById('sidebar-placeholder');
        const details = document.getElementById('sidebar-details');
        
        placeholder.classList.add('hidden');
        details.classList.remove('hidden');

        // Update sidebar content
        document.getElementById('selected-room-name').textContent = room.name;
        
        const roomTasks = tasks.filter(t => t.room_id === room.id && t.status !== 'done');
        const tasksContainer = document.getElementById('selected-room-tasks');
        tasksContainer.innerHTML = '';

        if (roomTasks.length === 0) {
            tasksContainer.innerHTML = '<p style="color:#aaa; text-align:center;">No pending tasks here. Great job!</p>';
        } else {
            roomTasks.forEach(t => {
                const assignee = roommates.find(r => r.id == t.roommate_id)?.name || 'Unassigned';
                
                const taskCard = document.createElement('div');
                taskCard.className = `mini-task-card priority-${t.priority}`;
                taskCard.innerHTML = `
                    <h4>${t.title}</h4>
                    <div class="mini-task-info">
                        <span>👤 ${assignee}</span>
                        <span>📅 ${t.due_date}</span>
                    </div>
                `;
                tasksContainer.appendChild(taskCard);
            });
        }
    }

    // --- CLOSE SIDEBAR ---

    // Handle close button click
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    if(btnCloseSidebar) {
        btnCloseSidebar.addEventListener('click', deselectRoom);
    }

    // Handle clicking empty map space
    document.getElementById('house-map').addEventListener('click', () => {
        deselectRoom();
    });

    // Reset selection and sidebar
    function deselectRoom() {
        selectedRoomId = null;
        renderMap();

        document.getElementById('sidebar-placeholder').classList.remove('hidden');
        document.getElementById('sidebar-details').classList.add('hidden');
    }

    function updateStats(currentTasks) {
        // Upcoming (pending), Overdue, Completed
        const now = new Date();
        
        const upcoming = tasks.filter(t => t.status !== 'done' && new Date(t.due_date) >= now).length;
        const overdue = tasks.filter(t => t.status !== 'done' && new Date(t.due_date) < now).length;
        // Completed logic would require filtering by date range, simplified here:
        const completed = tasks.filter(t => t.status === 'done').length; 

        document.getElementById('stat-upcoming').innerText = upcoming;
        document.getElementById('stat-overdue').innerText = overdue;
        document.getElementById('stat-completed').innerText = completed;
    }


    // --- 4. FORM HANDLING (POST) ---

    // Add Task
    document.getElementById('add-task-form').addEventListener('submit', async e => {
        e.preventDefault();
        const data = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            roommate_id: document.getElementById('task-roommate').value,
            room_id: document.getElementById('task-room-id').value, // Send Room ID
            priority: document.getElementById('task-priority').value,
            due_date: document.getElementById('task-due').value,
        };

        await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        e.target.reset();
        fetchTasks(); // Reload data
        alert("Task created!");
    });

    // Add Roommate
    document.getElementById('add-roommate-form').addEventListener('submit', async e => {
        e.preventDefault();
        const data = {
            name: document.getElementById('roommate-name').value,
            email: document.getElementById('roommate-email').value // Send Email
        };

        const res = await fetch(`${API_URL}/roommates`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });

        if (res.ok) {
            e.target.reset();
            fetchRoommates();
            alert("Roommate added!");
        } else {
            const err = await res.json();
            alert("Error: " + err.error);
        }
    });


    // --- 5. EVENTS & FILTERS ---

    function attachTaskEvents() {
        // Mark Done
        document.querySelectorAll('.btn-done').forEach(btn => {
            btn.addEventListener('click', async () => {
                const taskId = btn.dataset.id;
                await fetch(`${API_URL}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({status: 'done'})
                });
                fetchTasks();
            });
        });

        // Delete Task
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if(confirm('Delete this task?')) {
                    const taskId = btn.dataset.id;
                    await fetch(`${API_URL}/tasks/${taskId}`, {method: 'DELETE'});
                    fetchTasks();
                }
            });
        });
    }

    // Filter Listeners
    if (roommateFilter) {
        roommateFilter.addEventListener('change', () => {
            currentFilters.roommate = roommateFilter.value;
            renderTasks();
        });
    }

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


    // --- INITIALIZE ---
    fetchAllData();
});