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
app.use(express.static(path.join(__dirname)));

app.get('/user.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'user.html'));
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

const User = mongoose.model('User', userSchema);
const Vehicle = mongoose.model('Vehicle', vehicleSchema);
const AccessLog = mongoose.model('AccessLog', accessLogSchema);

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
    town, country, contact, password,
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
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check for existing vehicle by license plate or chassis number
    const existingVehicle = await Vehicle.findOne({
      $or: [{ licensePlate }, { chassisNumber }]
    });
    if (existingVehicle) {
      return res.status(400).json({ message: 'Vehicle already registered' });
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
      password: hashedPassword
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

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Vehicle Access Backend running on http://localhost:${PORT}`);
});
