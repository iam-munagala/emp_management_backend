const mongoose = require('mongoose');


const loginSchema = new mongoose.Schema({
  f_sno : {type: Number},
  f_userName: { type: String, required: true, unique: true },
  f_Pwd: { type: String, required: true }
});


const login = mongoose.model('t_login', loginSchema);
module.exports = login;
