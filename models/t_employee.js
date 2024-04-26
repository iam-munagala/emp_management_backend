const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  f_Image: { type: String, required: false }, // Assuming URL to the image, not required
  f_Name: { type: String, required: true },
  f_Email: { type: String, required: true, unique: true },
  f_Mobile: { type: String, required: true },
  f_Designation: { type: String, required: true },
  f_Gender: { type: String, required: true },
  f_Course: [String],
  f_CreateDate: { type: Date, default: Date.now },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 't_login' }
});

// If not already defined, compile the model
const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;
