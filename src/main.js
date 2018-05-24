const os = require('os');
const path = require('path');

const builder = require('./builder.js');
const database = require('./database.js');

(async function()
{
    var my_builder = await builder(path.join(os.homedir(), 'anttest'));
    await my_builder.index();
})()
