const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());  // Enable CORS for all routes

// Serve static files (including index.html)
app.use(express.static(path.join(__dirname)));

// SQLite database connection
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'
});

// Define User model
const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Define Objective model
const Objective = sequelize.define('Objective', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

// Define KeyResult model
const KeyResult = sequelize.define('KeyResult', {
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  target: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

// Define Task model
const Task = sequelize.define('Task', {
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Define relationships
User.hasMany(Objective);
Objective.belongsTo(User);

Objective.hasMany(KeyResult);
KeyResult.belongsTo(Objective);

KeyResult.hasMany(Task);
Task.belongsTo(KeyResult);

// Authentication Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret'); // Replace with a secure secret key
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Routes

// Register User
app.post('/api/users/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ where: { email } });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = await User.create({ email, password: hashedPassword });

    const payload = { user: { id: user.id } };
    jwt.sign(payload, 'your_jwt_secret', { expiresIn: 3600 }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login User
app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = { user: { id: user.id } };
    jwt.sign(payload, 'your_jwt_secret', { expiresIn: 3600 }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Create Objective with Key Results and Tasks
app.post('/api/objectives', authMiddleware, async (req, res) => {
  const { name, description, dueDate, keyResults } = req.body; // keyResults will include tasks for each key result

  try {
    const newObjective = await Objective.create({ name, description, dueDate, UserId: req.user.id });

    if (keyResults && keyResults.length) {
      keyResults.forEach(async (kr) => {
        const createdKeyResult = await KeyResult.create({
          description: kr.description,
          target: kr.target,
          ObjectiveId: newObjective.id
        });

        // Handle tasks under key results
        if (kr.tasks && kr.tasks.length) {
          kr.tasks.forEach(async (task) => {
            await Task.create({ description: task.description, KeyResultId: createdKeyResult.id });
          });
        }
      });
    }

    res.json(newObjective);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get User's Objectives
app.get('/api/objectives', authMiddleware, async (req, res) => {
  try {
    const objectives = await Objective.findAll({
      where: { UserId: req.user.id },
      include: [KeyResult]
    });
    res.json(objectives);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update Key Result Progress
app.put('/api/keyresults/:id/progress', authMiddleware, async (req, res) => {
  try {
    const { progress } = req.body;
    const keyResult = await KeyResult.findOne({ where: { id: req.params.id } });

    if (!keyResult) return res.status(404).json({ msg: 'Key Result not found' });

    keyResult.progress = progress;
    await keyResult.save();

    res.json(keyResult);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Sync database and start server
sequelize.sync().then(() => {
  app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}).catch(err => {
  console.error('Unable to connect to the database:', err);
});
const { spawn } = require('child_process');  // For spawning the Python process

// Route to handle conversational input
app.post('/api/converse', (req, res) => {
  const userInput = req.body.userInput;

  // Spawn a Python process to run the conversational model
  const pythonProcess = spawn('python', ['converse.py', userInput]);

  // Capture the output from the Python script
  pythonProcess.stdout.on('data', (data) => {
    res.json({ response: data.toString() });
  });

  pythonProcess.stderr.on('data', (error) => {
    console.error(`Error: ${error}`);
    res.status(500).json({ error: 'Error during conversation' });
  });
});