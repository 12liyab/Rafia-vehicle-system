// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = 50001; // Must match your frontend API_BASE_URL

app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'client')));

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// MongoDB connection string with credentials from environment variables
const mongoURI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.0amy0ov.mongodb.net/sves?retryWrites=true&w=majority&appName=Cluster0`;

// Connect to MongoDB
mongoose.connect(mongoURI).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});

// Define Mongoose Schemas and Models

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  address: String,
  town: String,
  country: String,
  contact: String,
  password: { type: String, required: true },
  userType: { type: String, enum: ['resident', 'staff', 'visitor', 'vendor'], default: 'visitor' },
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const vehicleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  licensePlate: { type: String, required: true, unique: true },
  chassisNumber: { type: String, required: true, unique: true },
  make: String,
  model: String,
  year: Number,
  color: String,
  createdAt: { type: Date, default: Date.now }
});

const accessLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  licensePlate: String,
  action: String,
  gate: String,
  direction: { type: String, enum: ['in', 'out'] },
  status: String,
  details: String,
  createdAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Vehicle = mongoose.model('Vehicle', vehicleSchema);
const AccessLog = mongoose.model('AccessLog', accessLogSchema);
const Admin = mongoose.model('Admin', adminSchema);

// Settings Schema and Model
const settingsSchema = new mongoose.Schema({
  systemName: { type: String, default: 'Smart Vehicle Entry System' },
  timezone: { type: String, default: 'UTC' },
  sessionTimeout: { type: Number, default: 30 },
  maxLoginAttempts: { type: Number, default: 5 },
  maintenanceMode: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: true },
  smsNotifications: { type: Boolean, default: false },
  pushNotifications: { type: Boolean, default: true },
  notificationEmail: { type: String, default: 'admin@vehicleentry.com' },
  notificationPhone: { type: String, default: '' },
  twoFactorAuth: { type: Boolean, default: false },
  passwordPolicy: { type: String, default: 'basic' },
  auditLogs: { type: Boolean, default: true },
  ipWhitelist: { type: Boolean, default: false },
  encryptionLevel: { type: String, default: 'standard' },
  autoBackup: { type: Boolean, default: true },
  backupTime: { type: String, default: '02:00' },
  backupRetention: { type: Number, default: 30 },
  backupLocation: { type: String, default: '/backups' },
  webhookUrl: { type: String, default: '' },
  integrationEnabled: { type: Boolean, default: false },
  logLevel: { type: String, default: 'info' },
  apiKey: { type: String, default: () => 'sk-' + Math.random().toString(36).substr(2, 16) },
  systemVersion: { type: String, default: 'v2.1.0' }
});

const Settings = mongoose.model('Settings', settingsSchema);

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    // Check MongoDB connection state
    const state = mongoose.connection.readyState;
    if (state === 1) { // connected
      res.json({ status: 'OK', message: 'MongoDB connection successful' });
    } else {
      res.status(500).json({ status: 'ERROR', message: 'MongoDB not connected' });
    }
  } catch (err) {
    console.error('❌ Health check failed:', err);
    res.status(500).json({ status: 'ERROR', message: 'Health check failed' });
  }
});

// Registration route
app.post('/api/register', async (req, res) => {
  const {
    firstName, lastName, username, email, address,
    town, country, contact, password, userType,
    licensePlate, chassisNumber, vehicleMake,
    vehicleModel, vehicleYear, vehicleColor
  } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !username || !email || !password || !licensePlate || !chassisNumber) {
    return res.status(400).json({ message: 'All required fields must be filled.' });
  }

  try {
    // Check for existing user by email or username
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    if (existingUser) {
      let message = 'User already exists';
      if (existingUser.email === email) {
        message = 'An account with this email address already exists';
      } else if (existingUser.username === username) {
        message = 'This username is already taken';
      }
      return res.status(400).json({ message });
    }

    // Check for existing vehicle by license plate or chassis number
    const existingVehicle = await Vehicle.findOne({
      $or: [{ licensePlate }, { chassisNumber }]
    });
    if (existingVehicle) {
      let message = 'Vehicle already registered';
      if (existingVehicle.licensePlate === licensePlate) {
        message = 'A vehicle with this license plate is already registered';
      } else if (existingVehicle.chassisNumber === chassisNumber) {
        message = 'A vehicle with this chassis number is already registered';
      }
      return res.status(400).json({ message });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new User({
      firstName,
      lastName,
      username,
      email,
      address,
      town,
      country,
      contact,
      password: hashedPassword,
      userType: userType || 'visitor'
    });
    const savedUser = await newUser.save();

    // Create vehicle
    const newVehicle = new Vehicle({
      userId: savedUser._id,
      licensePlate,
      chassisNumber,
      make: vehicleMake,
      model: vehicleModel,
      year: vehicleYear,
      color: vehicleColor
    });
    const savedVehicle = await newVehicle.save();

    // Log registration action
    const newAccessLog = new AccessLog({
      userId: savedUser._id,
      licensePlate,
      action: 'Registration',
      gate: 'Main Gate',
      direction: 'in',
      status: 'success',
      details: 'User registered and vehicle added.'
    });
    await newAccessLog.save();

    res.status(201).json({
      message: 'Registration successful',
      data: {
        user: {
          id: savedUser._id,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          email: savedUser.email
        },
        vehicle: {
          id: savedVehicle._id,
          licensePlate: savedVehicle.licensePlate,
          chassisNumber: savedVehicle.chassisNumber,
          make: savedVehicle.make,
          model: savedVehicle.model,
          year: savedVehicle.year,
          color: savedVehicle.color
        }
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Admin registration route
app.post('/api/admin/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Check if an admin already exists
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(400).json({ message: 'Admin account already exists. Only one admin is allowed.' });
    }

    // Check for existing admin (additional check, though count should suffice)
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { username }]
    });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    const newAdmin = new Admin({
      username,
      email,
      password: hashedPassword
    });
    const savedAdmin = await newAdmin.save();

    res.status(201).json({
      message: 'Admin registration successful',
      data: {
        id: savedAdmin._id,
        username: savedAdmin.username,
        email: savedAdmin.email
      }
    });

  } catch (error) {
    console.error('❌ Admin registration error:', error);
    res.status(500).json({ message: 'Server error during admin registration' });
  }
});

// Admin login route
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  // Validate required fields
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    // Find admin
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      message: 'Login successful',
      data: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get all users for admin dashboard
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    const vehicles = await Vehicle.find();
    const accessLogs = await AccessLog.find().sort({ createdAt: -1 }).limit(10);

    res.json({
      users: users,
      vehicles: vehicles,
      recentLogs: accessLogs
    });
  } catch (error) {
    console.error('❌ Error fetching admin data:', error);
    // Return mock data for demo when DB is unavailable
    const mockUsers = [
      {
        _id: 'mock1',
        firstName: 'Lee',
        lastName: 'Doe',
        username: 'leedoe',
        email: 'lee@example.com',
        contact: '+1234567890',
        userType: 'resident',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        _id: 'mock2',
        firstName: 'Jane',
        lastName: 'Smith',
        username: 'janesmith',
        email: 'jane@example.com',
        contact: '+0987654321',
        userType: 'staff',
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    ];
    const mockVehicles = [
      {
        _id: 'v1',
        userId: 'mock1',
        licensePlate: 'ABC123',
        make: 'Toyota',
        model: 'Camry',
        year: 2020
      },
      {
        _id: 'v2',
        userId: 'mock2',
        licensePlate: 'XYZ789',
        make: 'Honda',
        model: 'Civic',
        year: 2019
      }
    ];
    res.json({
      users: mockUsers,
      vehicles: mockVehicles,
      recentLogs: []
    });
  }
});

// Get single user details for admin
app.get('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id === 'null' || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }
  try {
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const vehicles = await Vehicle.find({ userId: id });
    res.json({
      user,
      vehicles
    });
  } catch (error) {
    console.error('❌ Error fetching user details:', error);
    // Return mock data for demo
    const mockUser = id === 'mock1' ? {
      _id: 'mock1',
      firstName: 'Lee',
      lastName: 'Doe',
      username: 'leedoe',
      email: 'lee@example.com',
      contact: '+1234567890',
      userType: 'resident',
      status: 'active',
      createdAt: new Date().toISOString()
    } : {
      _id: 'mock2',
      firstName: 'Jane',
      lastName: 'Smith',
      username: 'janesmith',
      email: 'jane@example.com',
      contact: '+0987654321',
      userType: 'staff',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    const mockVehicles = id === 'mock1' ? [{
      _id: 'v1',
      userId: 'mock1',
      licensePlate: 'ABC123',
      make: 'Toyota',
      model: 'Camry',
      year: 2020
    }] : [{
      _id: 'v2',
      userId: 'mock2',
      licensePlate: 'XYZ789',
      make: 'Honda',
      model: 'Civic',
      year: 2019
    }];
    res.json({
      user: mockUser,
      vehicles: mockVehicles
    });
  }
});

// Update user details for admin
app.put('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id === 'null' || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }
  const { firstName, lastName, email, contact } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { firstName, lastName, email, contact },
      { new: true }
    ).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    // For demo, just return success with mock updated data
    const mockUser = id === 'mock1' ? {
      _id: 'mock1',
      firstName: firstName || 'Lee',
      lastName: lastName || 'Doe',
      username: 'leedoe',
      email: email || 'lee@example.com',
      contact: contact || '+1234567890',
      userType: 'resident',
      status: 'active',
      createdAt: new Date().toISOString()
    } : {
      _id: 'mock2',
      firstName: firstName || 'Jane',
      lastName: lastName || 'Smith',
      username: 'janesmith',
      email: email || 'jane@example.com',
      contact: contact || '+0987654321',
      userType: 'staff',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    res.json({
      message: 'User updated successfully (demo mode)',
      user: mockUser
    });
  }
});

// Create user for admin
app.post('/api/admin/users', async (req, res) => {
  const { firstName, lastName, username, email, contact, userType, status } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !username || !email) {
    return res.status(400).json({ message: 'First name, last name, username, and email are required.' });
  }

  try {
    // Check for existing user by email or username
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    if (existingUser) {
      let message = 'User already exists';
      if (existingUser.email === email) {
        message = 'An account with this email address already exists';
      } else if (existingUser.username === username) {
        message = 'This username is already taken';
      }
      return res.status(400).json({ message });
    }

    // Generate a default password (user can change later)
    const defaultPassword = 'temp123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    // Create user
    const newUser = new User({
      firstName,
      lastName,
      username,
      email,
      contact,
      password: hashedPassword,
      userType: userType || 'visitor',
      status: status || 'active'
    });
    const savedUser = await newUser.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: savedUser._id,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        username: savedUser.username,
        email: savedUser.email,
        contact: savedUser.contact,
        userType: savedUser.userType,
        status: savedUser.status,
        createdAt: savedUser.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    res.status(500).json({ message: 'Server error during user creation' });
  }
});

// Delete user for admin
app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || id === 'null' || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }
  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Also delete associated vehicles
    await Vehicle.deleteMany({ userId: id });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    // For demo, just return success
    res.json({ message: 'User deleted successfully (demo mode)' });
  }
});

// Create vehicle for admin
app.post('/api/admin/vehicles', async (req, res) => {
  const { licensePlate, chassisNumber, make, model, year, color, userId } = req.body;

  // Validate required fields
  if (!licensePlate || !chassisNumber || !userId) {
    return res.status(400).json({ message: 'License plate, chassis number, and user ID are required.' });
  }

  // Validate userId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check for existing vehicle by license plate or chassis number
    const existingVehicle = await Vehicle.findOne({
      $or: [{ licensePlate }, { chassisNumber }]
    });
    if (existingVehicle) {
      let message = 'Vehicle already registered';
      if (existingVehicle.licensePlate === licensePlate) {
        message = 'A vehicle with this license plate is already registered';
      } else if (existingVehicle.chassisNumber === chassisNumber) {
        message = 'A vehicle with this chassis number is already registered';
      }
      return res.status(400).json({ message });
    }

    // Create vehicle
    const newVehicle = new Vehicle({
      userId,
      licensePlate,
      chassisNumber,
      make,
      model,
      year,
      color
    });
    const savedVehicle = await newVehicle.save();

    // Log vehicle addition
    const newAccessLog = new AccessLog({
      userId,
      licensePlate,
      action: 'Vehicle Added',
      gate: 'Admin Portal',
      direction: 'in',
      status: 'success',
      details: 'Vehicle added via admin portal.'
    });
    await newAccessLog.save();

    res.status(201).json({
      message: 'Vehicle added successfully',
      vehicle: {
        _id: savedVehicle._id,
        userId: savedVehicle.userId,
        licensePlate: savedVehicle.licensePlate,
        chassisNumber: savedVehicle.chassisNumber,
        make: savedVehicle.make,
        model: savedVehicle.model,
        year: savedVehicle.year,
        color: savedVehicle.color,
        createdAt: savedVehicle.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error creating vehicle:', error);
    res.status(500).json({ message: 'Server error during vehicle creation' });
  }
});

// Settings API routes
app.get('/api/admin/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/settings', async (req, res) => {
  try {
    const updateData = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(updateData);
    } else {
      Object.assign(settings, updateData);
    }
    await settings.save();
    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reports API routes
app.get('/api/admin/reports/stats', async (req, res) => {
  try {
    const totalEntries = await AccessLog.countDocuments();
    const deniedEntries = await AccessLog.countDocuments({ status: 'denied' });
    const activeUsers = await User.countDocuments({ status: 'active' });
    // Placeholder for avgEntryTime, as duration not stored
    const avgEntryTime = 2.3;

    res.json({
      totalEntries,
      avgEntryTime,
      deniedEntries,
      activeUsers
    });
  } catch (error) {
    console.error('Error fetching report stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/reports/charts', async (req, res) => {
  try {
    // Entry trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const entryTrendsAgg = await AccessLog.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]);
    const entryTrends = {
      labels: entryTrendsAgg.map(item => item._id),
      data: entryTrendsAgg.map(item => item.count)
    };

    // User type distribution
    const userTypeAgg = await User.aggregate([
      { $group: { _id: "$userType", count: { $sum: 1 } } }
    ]);
    const userType = {
      labels: userTypeAgg.map(item => item._id || 'Unknown'),
      data: userTypeAgg.map(item => item.count)
    };

    // Peak hours (simplified, group by hour)
    const peakHoursAgg = await AccessLog.aggregate([
      { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]);
    const peakHours = {
      labels: peakHoursAgg.map(item => `${item._id}:00`),
      data: peakHoursAgg.map(item => item.count)
    };

    // Access status distribution
    const accessStatusAgg = await AccessLog.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const accessStatus = {
      labels: accessStatusAgg.map(item => item._id || 'Unknown'),
      data: accessStatusAgg.map(item => item.count)
    };

    res.json({
      entryTrends,
      userType,
      peakHours,
      accessStatus
    });
  } catch (error) {
    console.error('Error fetching report charts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/reports/table', async (req, res) => {
  try {
    const logs = await AccessLog.find().populate('userId', 'firstName lastName').sort({ createdAt: -1 }).limit(50);
    const reports = logs.map(log => ({
      date: log.createdAt.toISOString().split('T')[0] + ' ' + log.createdAt.toTimeString().split(' ')[0],
      user: log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : 'Unknown',
      vehicle: log.licensePlate || 'N/A',
      type: log.direction === 'in' ? 'Entry' : 'Exit',
      status: log.status,
      duration: 'N/A' // Placeholder
    }));
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports table:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Vehicle Access Backend running on http://localhost:${PORT}`);
});
