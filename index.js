const conn = require("./connection");
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require('bcryptjs');
const cors = require('cors');
const tlogin = require('./models/t_login')
const MongoStore = require('connect-mongo');
const emp = require('./models/t_employee');
const AWS = require("aws-sdk");
const multer = require("multer");

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://circular-kizzie-vamsimunagala.koyeb.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});


app.use(cors());

app.use(cors({
  origin: 'https://emp-management-frontend-one.vercel.app',
  credentials: true
}));


const ObjectId = mongoose.Types.ObjectId;
dotenv.config();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const defaultSessionSecret = "mydefaultsecretkey";
const PORT = process.env.PORT || 5000;

app.use(session({
  secret: defaultSessionSecret,
  resave: true,
  saveUninitialized: true,
  httpOnly: false,
  store: MongoStore.create({ mongoUrl: 'mongodb+srv://admin:QjwWaXvnnuIZ46MY@cluster0.dteekjh.mongodb.net/' }),
  cookie: {secure:true,
    httpOnly:false,
     maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      // Both fields are required
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    try {
      const user = await tlogin.findOne({ f_userName : username });
      
      if (!user) {
        // User not found
        return res.status(401).json({ message: 'Invalid login details.' });
      }
      if (!(user.f_Pwd === password) ) {
        // Passwords do not match
        return res.status(401).json({ message: 'Invalid login details.' });
      }
  
      req.session.user = user;
      console.log(req.session);
      
      res.json({ message: 'Login successful.', user1: user.f_userName });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred during login.' });
    }
});
  
app.get('/dashboard', async(req, res) => {
  // console.log(req.session.user)
  try{
    if(req.session.user){
      const user = await tlogin.findById(req.session.user._id);
      res.json({userDetails: { username: user, totalEmployees: 5 } });
    }
    
    else{
      res.status(401).json({ message: 'Invalid login details.' });
    }
  }
  catch(err){
    console.log(err);
  }
    }
);

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out, please try again.' });
    }
    res.clearCookie('connect.sid'); // Replace 'connect.sid' with your session cookie name if different
    return res.status(200).json({ message: 'Logout successful.' });
  });
});

app.get('/employeelist', async (req, res) => {
  try {
    if(req.session.user){
    const user = await tlogin.findById(req.session.user._id);
    const employees = await emp.find(); // Fetch all employees
    res.json({
      user: user, // Send user data
      employees: employees // Send employees data
    });
    }
    else{
      res.status(500).json({ message: 'error occured' });
    } // Send the employee data
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    res.status(500).json({ message: 'Failed to fetch employees' });
  }
});

app.post('/addemployees', upload.single('image'), async (req, res) => {
  try {
    if(req.session.user){
    const admin = req.session.user._id;
    const { name, email, mobileNo, designation, gender, courses } = req.body;
    const file = req.file;
    const employeeId = new ObjectId();
    const key = `${employeeId}_profileimg`;
    const s3Params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `mern_task/${key}`,
      Body: file.buffer,
      ContentType: file.mimetype

    };
    const selectedCourses = Object.entries(JSON.parse(courses))
    .filter(([course, isChecked]) => isChecked)
    .map(([course]) => course);
    const s3UploadResponse = await s3.upload(s3Params).promise();
    const photoUrl = s3UploadResponse.Location;
    const newEmployee = new emp({
      _id: employeeId,
      f_Name:name,
      f_Email:email,
      f_Mobile:mobileNo,
      f_Designation:designation,
      f_Gender:gender,
      f_Course: selectedCourses,
      f_Image: photoUrl,
      admin // URL of the uploaded file in S3
    });
    
    await newEmployee.save();
    res.status(201).send('Employee added successfully');
  }
  else{
    res.status(500).json({ message: 'error occured' });
  }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding employee');
  }
});

app.post('/check-email', async (req, res) => {
  const { email } = req.body;
  console.log(email);
  const emailExists = await emp.findOne({ f_Email: email });
  if (emailExists) {
    console.log(emailExists);
      res.json({ isDuplicate: true });
  } else {
    console.log(emailExists);
      res.json({ isDuplicate: false });
  }
});

app.post('/edit-check-email/:employeeId', async (req, res) => {
  const { email } = req.body;
  const { employeeId } = req.params;
  console.log(employeeId,email);
  try {
    // Find an employee with the given email that is not the current employee being edited
    const employeeIdObj = new ObjectId(employeeId);
   
    const existingEmployee = await emp.findOne({ f_Email: email, _id: { $ne: employeeIdObj } });
    console.log(existingEmployee);
    if (existingEmployee) {
      // If such an employee exists, respond that this is a duplicate email
      return res.json({ isDuplicate: true });
    }
    // Otherwise, respond that this is not a duplicate email
    return res.json({ isDuplicate: false });
  } catch (error) {
    console.error('Failed to check email:', error);
    return res.status(500).send('Error checking email');
  }
});

app.delete('/deleteemployee/:id', async (req, res) => {
  try {
    const deletedEmployee = await emp.findByIdAndDelete(req.params.id);
    const url = new URL(deletedEmployee.f_Image);
    const key = url.pathname.substring(1);
    const s3DeleteParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    };

    await s3.deleteObject(s3DeleteParams).promise();
    if (!deletedEmployee) {
      return res.status(404).send({ message: 'Employee not found' });
    }

    res.status(200).send({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).send({ message: 'Failed to delete employee' });
  }
});

app.get('/getinfo/:employeeId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { employeeId } = req.params;
    const employee = await emp.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json(employee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/employeedata/:employeeId', upload.single('image'), async (req, res) => {
  const employeeId = req.params.employeeId; // Ensure it's a valid ObjectId
  const { name, email, mobileNo, designation, gender } = req.body;
  let coursesArray;
  
  try {
    const updateData = { f_Name:name, f_Email:email, f_Mobile:mobileNo, f_Designation:designation, f_Gender:gender };

    if (req.body.courses) {
      coursesArray = JSON.parse(req.body.courses);
      if (Array.isArray(coursesArray) && coursesArray.length) {
        updateData.f_Course = coursesArray;
      }
    }

    let photoUrl;
    if (req.file) {
      const file = req.file;
      const key = `${employeeId}_profileimg`;
      const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `mern_task/${key}`,
        Body: file.buffer,
        ContentType: file.mimetype
      };
      const s3UploadResponse = await s3.upload(s3Params).promise();
      photoUrl = s3UploadResponse.Location;
      updateData.f_Image = photoUrl; // Update image URL only if a new image was uploaded
    }
    console.log(updateData);
    // Update the employee in the database
    const updatedEmployee = await emp.findByIdAndUpdate(employeeId, updateData, { new: true });
    console.log(updatedEmployee)
    res.json(updatedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).send('Failed to update employee');
  }
});
