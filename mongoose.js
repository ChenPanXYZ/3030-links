const connectionString = 'mongodb+srv://chenpan:sD71fAu72N67Vm80@chenpan-8zw68.azure.mongodb.net/url-shortener?retryWrites=true&w=majority'
const mongoose = require('mongoose')
mongoose.connect(connectionString)

module.exports = mongoose