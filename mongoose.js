const connectionString = process.env.MONGODB_URI
const mongoose = require('mongoose')
mongoose.connect(connectionString)

module.exports = mongoose