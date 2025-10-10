// Sample data
let vehicles = [
    {
        id: 1,
        licensePlate: 'ABC 123',
        rfidTag: 'RFID001',
        owner: 'John Doe',
        type: 'employee',
        status: 'authorized'
    },
    {
        id: 2,
        licensePlate: 'XYZ 789',
        rfidTag: 'RFID002',
        owner: 'Jane Smith',
        type: 'visitor',
        status: 'authorized'
    }
];

let blacklist = ['DEF 456'];
let activityLog = [
    {
        plate: 'ABC 123',
        action: 'entered',
        gate: 'Main Gate',
        timestamp: new Date(Date.now() - 120000), // 2 minutes ago
        status: 'success'
    }
];

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');
const modal = document.getElementById('addVehicleModal');
const closeModal = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const addVehicleBtn = document.getElementById('addVehicleBtn');
const saveVehicleBtn = document.getElementById('saveVehicleBtn');
const vehicleForm = document.getElementById('vehicleForm');
const vehiclesTable = document.getElementById('vehiclesTable');
const blacklistContainer = document.getElementById('blacklistContainer');
const addToBlacklistBtn = document.getElementById('addToBlacklist');
const blacklistPlateInput = document.getElementById('blacklistPlate');
const manualOpenBtn = document.getElementById('manualOpen');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    updateTime();
    setInterval(updateTime, 1000);
    
    loadVehicles();
    loadBlacklist();
    updateStats();
    loadRecentActivity();
    
    setupEventListeners();
}

function setupEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.querySelector('a').getAttribute('href').substring(1);
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show target section
            contentSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === target) {
                    section.classList.add('active');
                }
            });
        });
    });

    // Modal handling
    addVehicleBtn.addEventListener('click', () => modal.style.display = 'block');
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    cancelBtn.addEventListener('click', () => modal.style.display = 'none');
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Form submission
    saveVehicleBtn.addEventListener('click', handleVehicleSubmit);
    addToBlacklistBtn.addEventListener('click', addToBlacklist);
    manualOpenBtn.addEventListener('click', manualOpenGate);
}

function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = 
        now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
}

function loadVehicles() {
    const tbody = vehiclesTable.querySelector('tbody');
    tbody.innerHTML = '';

    vehicles.forEach(vehicle => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${vehicle.licensePlate}</td>
            <td>${vehicle.rfidTag}</td>
            <td>${vehicle.owner}</td>
            <td><span class="badge badge-${vehicle.type}">${vehicle.type}</span></td>
            <td><span class="status-badge ${vehicle.status}">${vehicle.status}</span></td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="editVehicle(${vehicle.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteVehicle(${vehicle.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function loadBlacklist() {
    blacklistContainer.innerHTML = '';
    
    blacklist.forEach(plate => {
        const item = document.createElement('div');
        item.className = 'blacklist-item';
        item.innerHTML = `
            <span>${plate}</span>
            <button class="btn btn-sm btn-outline" onclick="removeFromBlacklist('${plate}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        blacklistContainer.appendChild(item);
    });
}

function updateStats() {
    document.getElementById('todayEntries').textContent = activityLog.length;
    document.getElementById('authorizedVehicles').textContent = vehicles.filter(v => v.status === 'authorized').length;
    document.getElementById('deniedAttempts').textContent = '0'; // You can update this with actual data
    document.getElementById('activeVisitors').textContent = vehicles.filter(v => v.type === 'visitor').length;
}

function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    container.innerHTML = '';

    activityLog.slice(-5).forEach(log => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-icon ${log.status}">
                <i class="fas fa-${log.status === 'success' ? 'check' : 'times'}"></i>
            </div>
            <div class="activity-details">
                <p><strong>${log.plate}</strong> ${log.action} through ${log.gate}</p>
                <span class="activity-time">${formatTimeAgo(log.timestamp)}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function handleVehicleSubmit() {
    const formData = new FormData(vehicleForm);
    const licensePlate = document.getElementById('licensePlate').value;
    
    if (!licensePlate) {
        alert('Please enter a license plate');
        return;
    }

    const newVehicle = {
        id: vehicles.length + 1,
        licensePlate: licensePlate,
        rfidTag: document.getElementById('rfidTag').value || `RFID${String(vehicles.length + 1).padStart(3, '0')}`,
        owner: document.getElementById('ownerName').value,
        type: document.getElementById('vehicleType').value,
        status: document.getElementById('isAuthorized').checked ? 'authorized' : 'pending'
    };

    vehicles.push(newVehicle);
    loadVehicles();
    updateStats();
    modal.style.display = 'none';
    vehicleForm.reset();
    
    // Add to activity log
    addActivityLog(newVehicle.licensePlate, 'registered', 'System', 'success');
}

function addToBlacklist() {
    const plate = blacklistPlateInput.value.trim();
    if (plate && !blacklist.includes(plate)) {
        blacklist.push(plate);
        loadBlacklist();
        blacklistPlateInput.value = '';
        addActivityLog(plate, 'blacklisted', 'System', 'danger');
    }
}

function removeFromBlacklist(plate) {
    blacklist = blacklist.filter(p => p !== plate);
    loadBlacklist();
    addActivityLog(plate, 'removed from blacklist', 'System', 'success');
}

function manualOpenGate() {
    // Simulate gate opening
    const gateStatus = document.querySelector('.gate-status .status-badge');
    gateStatus.className = 'status-badge open';
    gateStatus.innerHTML = '<i class="fas fa-lock-open"></i> Gate Opening...';
    
    addActivityLog('MANUAL', 'gate opened manually', 'Main Gate', 'success');
    
    // Reset after 5 seconds
    setTimeout(() => {
        gateStatus.className = 'status-badge closed';
        gateStatus.innerHTML = '<i class="fas fa-lock"></i> Gate Closed';
    }, 5000);
}

function addActivityLog(plate, action, gate, status) {
    activityLog.push({
        plate,
        action,
        gate,
        timestamp: new Date(),
        status
    });
    loadRecentActivity();
    updateStats();
}

function formatTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return timestamp.toLocaleDateString();
}

// Placeholder functions for future implementation
function editVehicle(id) {
    alert(`Edit vehicle ${id} - To be implemented`);
}

function deleteVehicle(id) {
    if (confirm('Are you sure you want to delete this vehicle?')) {
        vehicles = vehicles.filter(v => v.id !== id);
        loadVehicles();
        updateStats();
        addActivityLog(id, 'vehicle deleted', 'System', 'danger');
    }
}